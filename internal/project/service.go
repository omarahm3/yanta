package project

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"yanta/internal/events"
	"yanta/internal/logger"
	"yanta/internal/vault"
)

type SyncNotifier interface {
	NotifyChange(reason string)
}

type Service struct {
	db           *sql.DB
	store        *Store
	cache        *Cache
	vault        *vault.Vault
	eventBus     *events.EventBus
	syncNotifier SyncNotifier
}

func NewService(
	db *sql.DB,
	store *Store,
	cache *Cache,
	v *vault.Vault,
	syncNotifier SyncNotifier,
	eventBus *events.EventBus,
) *Service {
	return &Service{
		db:           db,
		store:        store,
		cache:        cache,
		vault:        v,
		eventBus:     eventBus,
		syncNotifier: syncNotifier,
	}
}

func (s *Service) emitEvent(eventName string, payload any) {
	if s.eventBus != nil {
		s.eventBus.Emit(eventName, payload)
	}
}

func (s *Service) notifySync(reason string) {
	if s.syncNotifier == nil {
		return
	}
	s.syncNotifier.NotifyChange(reason)
}

func (s *Service) GetCache() *Cache {
	return s.cache
}

func (s *Service) Create(
	ctx context.Context,
	name, alias, startDate, endDate string,
) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("name is required")
	}

	p, err := New(
		name,
		strings.TrimSpace(alias),
		strings.TrimSpace(startDate),
		strings.TrimSpace(endDate),
	)
	if err != nil {
		return "", fmt.Errorf("creating project: %w", err)
	}

	p, err = s.store.Create(ctx, p)
	if err != nil {
		return "", fmt.Errorf("storing project: %w", err)
	}

	metadata := &vault.ProjectMetadata{
		Alias:     p.Alias,
		Name:      p.Name,
		StartDate: p.StartDate,
		EndDate:   p.EndDate,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
	if err := s.vault.WriteProjectMetadata(metadata); err != nil {
		logger.WithField("alias", p.Alias).
			WithError(err).
			Warn("failed to write project metadata file")
	}
	s.notifySync(fmt.Sprintf("project %s metadata created", p.Alias))

	s.cache.Set(p)

	s.emitEvent(events.ProjectCreated, map[string]any{
		"id":    p.ID,
		"name":  p.Name,
		"alias": p.Alias,
	})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": p.ID,
		"op": "create",
	})

	logger.WithFields(map[string]any{
		"id":    p.ID,
		"name":  p.Name,
		"alias": p.Alias,
	}).Info("project created")

	return p.ID, nil
}

func (s *Service) Update(ctx context.Context, p *Project) error {
	if p == nil || strings.TrimSpace(p.ID) == "" {
		return errors.New("invalid project")
	}

	if strings.TrimSpace(p.Name) == "" {
		return errors.New("name is required")
	}

	if err := Validate(p); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	p, err := s.store.Update(ctx, p)
	if err != nil {
		return fmt.Errorf("updating project: %w", err)
	}

	metadata := &vault.ProjectMetadata{
		Alias:     p.Alias,
		Name:      p.Name,
		StartDate: p.StartDate,
		EndDate:   p.EndDate,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
	if err := s.vault.WriteProjectMetadata(metadata); err != nil {
		logger.WithField("alias", p.Alias).
			WithError(err).
			Warn("failed to update project metadata file")
	}
	s.notifySync(fmt.Sprintf("project %s metadata updated", p.Alias))

	s.cache.Invalidate(p.ID)

	s.emitEvent(events.ProjectUpdated, map[string]any{
		"id":    p.ID,
		"name":  p.Name,
		"alias": p.Alias,
	})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": p.ID,
		"op": "update",
	})

	logger.WithFields(map[string]any{
		"id":   p.ID,
		"name": p.Name,
	}).Info("project updated")

	return nil
}

func (s *Service) Get(ctx context.Context, id string) (*Project, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("id is required")
	}

	project, err := s.cache.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("getting project: %w", err)
	}

	s.emitEvent(events.ProjectAccessed, map[string]any{
		"id":    project.ID,
		"name":  project.Name,
		"alias": project.Alias,
	})

	return project, nil
}

func (s *Service) ListActive(ctx context.Context) ([]*Project, error) {
	ongoing := true
	filters := &GetFilters{
		Ongoing:        &ongoing,
		IncludeDeleted: false,
	}

	projects, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).Error("failed to list active projects")
		return nil, fmt.Errorf("listing active projects: %w", err)
	}

	s.emitEvent(events.ProjectListAccessed, map[string]any{
		"type":  "active",
		"count": len(projects),
	})

	return projects, nil
}

func (s *Service) ListArchived(ctx context.Context) ([]*Project, error) {
	archived := true
	filters := &GetFilters{
		Archived:       &archived,
		IncludeDeleted: false,
	}

	projects, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).Error("failed to list archived projects")
		return nil, fmt.Errorf("listing archived projects: %w", err)
	}

	s.emitEvent(events.ProjectListAccessed, map[string]any{
		"type":  "archived",
		"count": len(projects),
	})

	return projects, nil
}

func (s *Service) SoftDelete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("id is required")
	}

	if err := s.store.SoftDelete(ctx, id); err != nil {
		logger.WithField("id", id).WithError(err).Error("failed to soft delete project")
		return fmt.Errorf("soft deleting project: %w", err)
	}

	s.cache.Invalidate(id)
	s.cache.InvalidateDocumentCount(id)

	s.emitEvent(events.ProjectDeleted, map[string]any{"id": id})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": id,
		"op": "delete",
	})

	logger.WithField("id", id).Info("project soft deleted")

	return nil
}

func (s *Service) Restore(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("id is required")
	}

	if err := s.store.Restore(ctx, id); err != nil {
		logger.WithField("id", id).WithError(err).Error("failed to restore project")
		return fmt.Errorf("restoring project: %w", err)
	}

	s.cache.Invalidate(id)

	s.emitEvent(events.ProjectRestored, map[string]any{"id": id})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": id,
		"op": "restore",
	})

	logger.WithField("id", id).Info("project restored")

	return nil
}

// If project has documents: soft delete project (documents handled separately)
// If no documents: hard delete project
func (s *Service) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("id is required")
	}

	var docCount int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM doc WHERE project_alias = (
			SELECT alias FROM project WHERE id = ? AND deleted_at IS NULL
		) AND deleted_at IS NULL`,
		id).Scan(&docCount)
	if err != nil {
		logger.WithField("id", id).WithError(err).Error("failed to count documents")
		return fmt.Errorf("counting documents: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if docCount > 0 {
		if err := s.store.SoftDeleteTx(ctx, tx, id); err != nil {
			logger.WithField("id", id).
				WithError(err).
				Error("failed to soft delete project with documents")
			return fmt.Errorf("soft deleting project: %w", err)
		}
	} else {
		if err := s.store.HardDeleteTx(ctx, tx, id); err != nil {
			logger.WithField("id", id).WithError(err).Error("failed to hard delete project")
			return fmt.Errorf("hard deleting project: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	s.cache.Invalidate(id)
	s.cache.InvalidateDocumentCount(id)
	s.cache.InvalidateLastDocumentDate(id)

	s.emitEvent(events.ProjectDeleted, map[string]any{"id": id})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": id,
		"op": "delete",
	})

	logger.WithFields(map[string]any{
		"id":       id,
		"docCount": docCount,
	}).Info("project deleted")

	return nil
}

func (s *Service) HardDelete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("id is required")
	}

	proj, err := s.Get(ctx, id)
	if err != nil {
		logger.WithField("id", id).WithError(err).Error("failed to get project for hard deletion")
		return fmt.Errorf("getting project: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.store.HardDeleteTx(ctx, tx, id); err != nil {
		logger.WithField("id", id).WithError(err).Error("failed to hard delete project")
		return fmt.Errorf("hard deleting project: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	s.cache.Invalidate(id)
	s.cache.InvalidateDocumentCount(id)
	s.cache.InvalidateLastDocumentDate(id)

	s.emitEvent(events.ProjectDeleted, map[string]any{
		"id":   id,
		"hard": true,
	})
	s.emitEvent(events.ProjectChanged, map[string]any{
		"id": id,
		"op": "delete",
	})

	logger.WithFields(map[string]any{
		"id":    id,
		"alias": proj.Alias,
	}).Info("project hard deleted")

	return nil
}

func (s *Service) GetAllDocumentCounts(ctx context.Context) (map[string]int, error) {
	query := `
		SELECT id, doc_count
		FROM v_project_doc_counts
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		logger.WithError(err).Error("failed to query document counts")
		return nil, fmt.Errorf("querying document counts: %w", err)
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			logger.WithError(err).Error("failed to scan document count")
			return nil, fmt.Errorf("scanning document count: %w", err)
		}
		result[id] = count
		s.cache.SetDocumentCount(id, count)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating document counts: %w", err)
	}

	return result, nil
}

func (s *Service) GetDocumentCount(ctx context.Context, projectID string) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT doc_count FROM v_project_doc_counts WHERE id = ?`,
		projectID).Scan(&count)

	if err == sql.ErrNoRows {
		count = 0
	} else if err != nil {
		logger.WithField("projectID", projectID).WithError(err).Error("failed to count documents")
		return 0, fmt.Errorf("counting documents: %w", err)
	}

	s.cache.SetDocumentCount(projectID, count)
	return count, nil
}

func (s *Service) UpdateDocumentCount(ctx context.Context, projectID string) error {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT doc_count FROM v_project_doc_counts WHERE id = ?`,
		projectID).Scan(&count)

	if err == sql.ErrNoRows {
		count = 0
	} else if err != nil {
		logger.WithField("projectID", projectID).WithError(err).Error("failed to count documents")
		return fmt.Errorf("counting documents: %w", err)
	}

	s.cache.SetDocumentCount(projectID, count)
	return nil
}

func (s *Service) GetAllLastDocumentDates(ctx context.Context) (map[string]string, error) {
	query := `
		SELECT id, last_updated
		FROM v_project_doc_counts
		WHERE last_updated IS NOT NULL
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		logger.WithError(err).Error("failed to query last document dates")
		return nil, fmt.Errorf("querying last document dates: %w", err)
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var id, lastDate string
		if err := rows.Scan(&id, &lastDate); err != nil {
			logger.WithError(err).Error("failed to scan last document date")
			return nil, fmt.Errorf("scanning last document date: %w", err)
		}
		result[id] = lastDate
		s.cache.SetLastDocumentDate(id, lastDate)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating last document dates: %w", err)
	}

	return result, nil
}
