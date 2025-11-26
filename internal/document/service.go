package document

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path"
	"strings"
	"sync"
	"time"

	"yanta/internal/events"
	"yanta/internal/logger"
	"yanta/internal/project"
	"yanta/internal/vault"

	"github.com/google/uuid"
)

type Indexer interface {
	IndexDocument(ctx context.Context, docPath string) error
	ReindexDocument(ctx context.Context, docPath string) error
	RemoveDocument(ctx context.Context, docPath string) error
}

type ProjectCache interface {
	GetByAlias(ctx context.Context, alias string) (*project.Project, error)
}

type Service struct {
	db           *sql.DB
	store        *Store
	fm           *FileManager
	indexer      Indexer
	projectCache ProjectCache
	eventBus     *events.EventBus
	saveMu       sync.Mutex // Serializes Save operations to prevent race conditions
}

func NewService(db *sql.DB, store *Store, v *vault.Vault, idx Indexer, projectCache ProjectCache, eventBus *events.EventBus) *Service {
	return &Service{
		db:           db,
		store:        store,
		fm:           NewFileManager(v),
		indexer:      idx,
		projectCache: projectCache,
		eventBus:     eventBus,
	}
}

func (s *Service) emitEvent(eventName string, payload any) {
	if s.eventBus != nil {
		s.eventBus.Emit(eventName, payload)
	}
}

func (s *Service) emitDocumentCountChange(ctx context.Context, projectAlias string) {
	if s.eventBus == nil {
		return
	}

	proj, err := s.projectCache.GetByAlias(ctx, projectAlias)
	if err != nil {
		logger.WithError(err).WithField("alias", projectAlias).Warn("failed to get project for count event")
		return
	}

	var count int
	err = s.db.QueryRowContext(ctx,
		`SELECT doc_count FROM v_project_doc_counts WHERE id = ?`,
		proj.ID).Scan(&count)

	if err == sql.ErrNoRows {
		count = 0
	} else if err != nil {
		logger.WithField("projectID", proj.ID).WithError(err).Warn("failed to get count for event")
		return
	}

	s.emitEvent(events.EntryCountChanged, map[string]any{
		"projectId": proj.ID,
		"count":     count,
	})
}

type SaveRequest struct {
	Path         string
	ProjectAlias string
	Title        string
	Blocks       []BlockNoteBlock
	Tags         []string
}

func (s *Service) Save(ctx context.Context, req SaveRequest) (string, error) {
	// Serialize Save operations to prevent race conditions where concurrent saves
	// can cause file write conflicts and FK constraint errors during IndexDocument.
	// This ensures that WriteFile and IndexDocument are atomic with respect to each other.
	s.saveMu.Lock()
	defer s.saveMu.Unlock()

	if err := project.ValidateAlias(strings.TrimSpace(req.ProjectAlias)); err != nil {
		return "", fmt.Errorf("invalid project_alias: %w", err)
	}

	req.ProjectAlias = strings.TrimSpace(req.ProjectAlias)
	if strings.TrimSpace(req.Title) == "" {
		return "", errors.New("title is required")
	}

	isNew := req.Path == ""
	var docPath string

	if isNew {
		docID := strings.ReplaceAll(uuid.New().String(), "-", "")[:12]
		aliasSlug := strings.TrimPrefix(req.ProjectAlias, "@")
		filename := fmt.Sprintf("doc-%s-%s.json", aliasSlug, docID)
		docPath = path.Join("projects", req.ProjectAlias, filename)
	} else {
		docPath = req.Path
	}

	docFile := &DocumentFile{
		Meta: DocumentMeta{
			Project: req.ProjectAlias,
			Title:   req.Title,
			Tags:    req.Tags,
			Created: time.Now(),
			Updated: time.Now(),
		},
		Blocks: req.Blocks,
	}

	if !isNew {
		existing, err := s.fm.ReadFile(docPath)
		if err != nil {
			logger.WithError(err).WithField("path", docPath).Error("failed to read existing document")
			return "", fmt.Errorf("reading existing document: %w", err)
		}
		docFile.Meta.Created = existing.Meta.Created
	}

	if err := s.fm.WriteFile(docPath, docFile); err != nil {
		logger.WithError(err).WithField("path", docPath).Error("failed to write document file")
		return "", fmt.Errorf("writing document file: %w", err)
	}

	if err := s.indexer.IndexDocument(ctx, docPath); err != nil {
		logger.WithError(err).WithField("path", docPath).Error("failed to index document")
		s.fm.DeleteFile(docPath)
		return "", fmt.Errorf("indexing document: %w", err)
	}

	projectID := req.ProjectAlias
	if proj, err := s.projectCache.GetByAlias(ctx, req.ProjectAlias); err == nil && proj != nil {
		projectID = proj.ID
	}

	if isNew {
		s.emitEvent(events.EntryCreated, map[string]any{
			"path":      docPath,
			"projectId": projectID,
			"title":     req.Title,
		})
		s.emitDocumentCountChange(ctx, req.ProjectAlias)
	} else {
		s.emitEvent(events.EntryUpdated, map[string]any{
			"path":      docPath,
			"projectId": projectID,
			"title":     req.Title,
		})
	}

	logger.WithFields(map[string]any{
		"path":    docPath,
		"project": req.ProjectAlias,
		"isNew":   isNew,
	}).Info("document saved")

	return docPath, nil
}

type DocumentWithTags struct {
	*Document
	File *DocumentFile
	Tags []string
}

func (s *Service) Get(ctx context.Context, path string) (*DocumentWithTags, error) {
	logger.WithField("path", path).Info("document Get called")

	if strings.TrimSpace(path) == "" {
		logger.Warn("document Get called with empty path")
		return nil, errors.New("path is required")
	}

	logger.WithField("path", path).Debug("fetching document metadata from database")
	doc, err := s.store.GetByPath(ctx, path)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.WithField("path", path).Info("document not found in active records, attempting to include archived")
			doc, err = s.store.GetByPathIncludingDeleted(ctx, path)
			if err != nil {
				logger.WithError(err).WithField("path", path).Error("failed to get document metadata (including archived)")
				return nil, fmt.Errorf("getting document metadata: %w", err)
			}
		} else {
			logger.WithError(err).WithField("path", path).Error("failed to get document metadata")
			return nil, fmt.Errorf("getting document metadata: %w", err)
		}
	}
	logger.WithFields(map[string]any{
		"path":  path,
		"title": doc.Title,
	}).Debug("document metadata retrieved successfully")

	logger.WithField("path", path).Debug("reading document file from disk")
	file, err := s.fm.ReadFile(path)
	if err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to read document file")
		return nil, fmt.Errorf("reading document file: %w", err)
	}
	logger.WithFields(map[string]any{
		"path":        path,
		"blocksCount": len(file.Blocks),
		"tagsCount":   len(file.Meta.Tags),
	}).Debug("document file read successfully")

	accessedProjectID := doc.ProjectAlias
	if proj, err := s.projectCache.GetByAlias(ctx, doc.ProjectAlias); err == nil && proj != nil {
		accessedProjectID = proj.ID
	}
	s.emitEvent(events.EntryAccessed, map[string]any{
		"path":      path,
		"projectId": accessedProjectID,
		"title":     doc.Title,
	})

	logger.WithFields(map[string]any{
		"path":  path,
		"title": doc.Title,
	}).Info("document Get completed successfully")

	return &DocumentWithTags{
		Document: doc,
		File:     file,
		Tags:     file.Meta.Tags,
	}, nil
}

func (s *Service) ListByProject(ctx context.Context, projectAlias string, includeArchived bool, limit, offset int) ([]*Document, error) {
	projectAlias = strings.TrimSpace(projectAlias)
	if err := project.ValidateAlias(projectAlias); err != nil {
		return nil, fmt.Errorf("invalid project_alias: %w", err)
	}

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	filters := &GetFilters{
		ProjectAlias:   &projectAlias,
		IncludeDeleted: includeArchived,
	}

	docs, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).WithField("projectAlias", projectAlias).Error("failed to list documents")
		return nil, fmt.Errorf("listing documents: %w", err)
	}

	if offset >= len(docs) {
		return []*Document{}, nil
	}

	end := offset + limit
	if end > len(docs) {
		end = len(docs)
	}

	result := docs[offset:end]

	s.emitEvent(events.EntryListAccessed, map[string]any{
		"projectId": projectAlias,
		"count":     len(result),
		"limit":     limit,
		"offset":    offset,
	})

	return result, nil
}

func (s *Service) SoftDelete(ctx context.Context, path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("path is required")
	}

	doc, err := s.store.GetByPath(ctx, path)
	if err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to get document for deletion")
		return fmt.Errorf("getting document: %w", err)
	}

	if err := s.store.SoftDelete(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to soft delete document")
		return fmt.Errorf("soft deleting document: %w", err)
	}

	if err := s.indexer.RemoveDocument(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Warn("failed to remove from index")
	}

	deletedProjectID := doc.ProjectAlias
	if proj, err := s.projectCache.GetByAlias(ctx, doc.ProjectAlias); err == nil && proj != nil {
		deletedProjectID = proj.ID
	}
	s.emitEvent(events.EntryDeleted, map[string]any{
		"path":      path,
		"projectId": deletedProjectID,
	})
	s.emitDocumentCountChange(ctx, doc.ProjectAlias)

	logger.WithFields(map[string]any{
		"path":    path,
		"project": doc.ProjectAlias,
	}).Info("document soft deleted")

	return nil
}

func (s *Service) Restore(ctx context.Context, path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("path is required")
	}

	filters := &GetFilters{
		ProjectAlias:   nil,
		IncludeDeleted: true,
	}

	docs, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to query documents")
		return fmt.Errorf("querying documents: %w", err)
	}

	var doc *Document
	for _, d := range docs {
		if d.Path == path && d.DeletedAt != "" {
			doc = d
			break
		}
	}

	if doc == nil {
		return fmt.Errorf("document not found or not deleted: %s", path)
	}

	if err := s.store.Restore(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to restore document")
		return fmt.Errorf("restoring document: %w", err)
	}

	if err := s.indexer.ReindexDocument(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Warn("failed to reindex")
	}

	restoredProjectID := doc.ProjectAlias
	if proj, err := s.projectCache.GetByAlias(ctx, doc.ProjectAlias); err == nil && proj != nil {
		restoredProjectID = proj.ID
	}
	s.emitEvent(events.EntryRestored, map[string]any{
		"path":      path,
		"projectId": restoredProjectID,
	})
	s.emitDocumentCountChange(ctx, doc.ProjectAlias)

	logger.WithFields(map[string]any{
		"path":    path,
		"project": doc.ProjectAlias,
	}).Info("document restored")

	return nil
}

func (s *Service) SoftDeleteByProject(ctx context.Context, projectAlias string) error {
	projectAlias = strings.TrimSpace(projectAlias)
	if err := project.ValidateAlias(projectAlias); err != nil {
		return fmt.Errorf("invalid project_alias: %w", err)
	}

	if err := s.store.SoftDeleteByProject(ctx, projectAlias); err != nil {
		logger.WithError(err).WithField("projectAlias", projectAlias).Error("failed to soft delete documents by project")
		return fmt.Errorf("soft deleting documents by project: %w", err)
	}

	logger.WithField("projectAlias", projectAlias).Info("documents soft deleted by project")

	return nil
}

func (s *Service) HardDelete(ctx context.Context, path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("path is required")
	}

	doc, err := s.store.GetByPath(ctx, path)
	if err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to get document for hard deletion")
		return fmt.Errorf("getting document: %w", err)
	}

	if err := s.fm.DeleteFile(path); err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to delete document file from vault")
		return fmt.Errorf("deleting document file: %w", err)
	}

	if err := s.store.HardDelete(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Error("failed to hard delete document from database")
		return fmt.Errorf("hard deleting document from database: %w", err)
	}

	if err := s.indexer.RemoveDocument(ctx, path); err != nil {
		logger.WithError(err).WithField("path", path).Warn("failed to remove from index")
	}

	deletedProjectID := doc.ProjectAlias
	if proj, err := s.projectCache.GetByAlias(ctx, doc.ProjectAlias); err == nil && proj != nil {
		deletedProjectID = proj.ID
	}

	s.emitEvent(events.EntryDeleted, map[string]any{
		"path":      path,
		"projectId": deletedProjectID,
		"hard":      true,
	})
	s.emitDocumentCountChange(ctx, doc.ProjectAlias)

	logger.WithFields(map[string]any{
		"path":    path,
		"project": doc.ProjectAlias,
	}).Info("document hard deleted")

	return nil
}

func (s *Service) HardDeleteBatch(ctx context.Context, paths []string) error {
	if len(paths) == 0 {
		return errors.New("paths list cannot be empty")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	deletedDocs := make(map[string]*Document)
	for _, path := range paths {
		if strings.TrimSpace(path) == "" {
			return fmt.Errorf("invalid empty path in batch")
		}

		doc, err := s.store.GetByPathIncludingDeletedTx(ctx, tx, path)
		if err != nil {
			logger.WithError(err).WithField("path", path).Error("failed to get document for batch hard deletion")
			return fmt.Errorf("getting document %s: %w", path, err)
		}
		deletedDocs[path] = doc
	}

	for _, path := range paths {
		if err := s.store.HardDeleteTx(ctx, tx, path); err != nil {
			logger.WithError(err).WithField("path", path).Error("failed to hard delete document from database in batch")
			return fmt.Errorf("hard deleting document %s from database: %w", path, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	for _, path := range paths {
		if err := s.fm.DeleteFile(path); err != nil {
			logger.WithError(err).WithField("path", path).Warn("failed to delete document file from vault in batch")
		}

		if err := s.indexer.RemoveDocument(ctx, path); err != nil {
			logger.WithError(err).WithField("path", path).Warn("failed to remove from index in batch")
		}

		if doc, ok := deletedDocs[path]; ok {
			deletedProjectID := doc.ProjectAlias
			if proj, err := s.projectCache.GetByAlias(ctx, doc.ProjectAlias); err == nil && proj != nil {
				deletedProjectID = proj.ID
			}

			s.emitEvent(events.EntryDeleted, map[string]any{
				"path":      path,
				"projectId": deletedProjectID,
				"hard":      true,
			})
			s.emitDocumentCountChange(ctx, doc.ProjectAlias)
		}
	}

	logger.WithField("count", len(paths)).Info("documents hard deleted in batch")

	return nil
}

func (s *Service) HardDeleteByProject(ctx context.Context, projectAlias string) error {
	projectAlias = strings.TrimSpace(projectAlias)
	if err := project.ValidateAlias(projectAlias); err != nil {
		return fmt.Errorf("invalid project_alias: %w", err)
	}

	filters := &GetFilters{
		ProjectAlias:   &projectAlias,
		IncludeDeleted: true,
	}

	docs, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).WithField("projectAlias", projectAlias).Error("failed to get documents for hard deletion by project")
		return fmt.Errorf("getting documents by project: %w", err)
	}

	if len(docs) == 0 {
		logger.WithField("projectAlias", projectAlias).Info("no documents to hard delete for project")
		return nil
	}

	var paths []string
	for _, doc := range docs {
		paths = append(paths, doc.Path)
	}

	if err := s.HardDeleteBatch(ctx, paths); err != nil {
		logger.WithError(err).WithField("projectAlias", projectAlias).Error("failed to hard delete documents by project")
		return fmt.Errorf("hard deleting documents by project: %w", err)
	}

	logger.WithFields(map[string]any{
		"projectAlias": projectAlias,
		"count":        len(paths),
	}).Info("all documents hard deleted for project")

	return nil
}
