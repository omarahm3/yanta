package tag

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sirupsen/logrus"

	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/logger"
)

type Service struct {
	db       *sql.DB
	store    *Store
	fm       *document.FileManager
	eventBus *events.EventBus
}

func NewService(
	db *sql.DB,
	store *Store,
	fm *document.FileManager,
	eventBus *events.EventBus,
) *Service {
	return &Service{
		db:       db,
		store:    store,
		fm:       fm,
		eventBus: eventBus,
	}
}

func (s *Service) emitEvent(eventName string, payload any) {
	if s.eventBus != nil {
		s.eventBus.Emit(eventName, payload)
	}
}

func (s *Service) Create(ctx context.Context, name string) (string, error) {
	tag, err := New(name)
	if err != nil {
		logger.WithError(err).WithField("name", name).Error("failed to validate tag")
		return "", fmt.Errorf("validating tag: %w", err)
	}

	created, err := s.store.Create(ctx, tag)
	if err != nil {
		logger.WithError(err).WithField("name", name).Error("failed to create tag")
		return "", fmt.Errorf("creating tag: %w", err)
	}

	s.emitEvent(events.TagCreated, created)

	logger.WithFields(logrus.Fields{
		"name": created.Name,
	}).Info("tag created")

	return created.Name, nil
}

func (s *Service) GetByName(ctx context.Context, name string) (*Tag, error) {
	normalized := Normalize(name)

	tag, err := s.store.GetByName(ctx, normalized)
	if err != nil {
		logger.WithError(err).WithField("name", normalized).Error("failed to get tag")
		return nil, fmt.Errorf("getting tag: %w", err)
	}

	return tag, nil
}

func (s *Service) ListActive(ctx context.Context) ([]*Tag, error) {
	filters := &GetFilters{
		IncludeDeleted: false,
	}

	tags, err := s.store.Get(ctx, filters)
	if err != nil {
		logger.WithError(err).Error("failed to list active tags")
		return nil, fmt.Errorf("listing active tags: %w", err)
	}

	return tags, nil
}

func (s *Service) SoftDelete(ctx context.Context, name string) error {
	normalized := Normalize(name)

	if err := s.store.SoftDelete(ctx, normalized); err != nil {
		logger.WithError(err).WithField("name", normalized).Error("failed to soft delete tag")
		return fmt.Errorf("soft deleting tag: %w", err)
	}

	s.emitEvent(events.TagDeleted, normalized)

	logger.WithField("name", normalized).Info("tag soft deleted")
	return nil
}

func (s *Service) Restore(ctx context.Context, name string) error {
	normalized := Normalize(name)

	if err := s.store.Restore(ctx, normalized); err != nil {
		logger.WithError(err).WithField("name", normalized).Error("failed to restore tag")
		return fmt.Errorf("restoring tag: %w", err)
	}

	s.emitEvent(events.TagUpdated, normalized)

	logger.WithField("name", normalized).Info("tag restored")
	return nil
}

func (s *Service) Delete(ctx context.Context, name string) error {
	normalized := Normalize(name)

	if err := s.store.HardDelete(ctx, normalized); err != nil {
		logger.WithError(err).WithField("name", normalized).Error("failed to delete tag")
		return fmt.Errorf("deleting tag: %w", err)
	}

	s.emitEvent(events.TagDeleted, normalized)

	logger.WithField("name", normalized).Info("tag deleted")
	return nil
}

func (s *Service) AddTagsToDocument(ctx context.Context, docPath string, tagNames []string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	if len(tagNames) == 0 {
		return fmt.Errorf("at least one tag name is required")
	}

	err := s.fm.UpdateFile(docPath, func(doc *document.DocumentFile) error {
		doc.Meta.Tags = append(doc.Meta.Tags, tagNames...)
		return nil
	})
	if err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"docPath": docPath,
			"tags":    tagNames,
		}).Error("failed to update document file")
		return fmt.Errorf("updating document file: %w", err)
	}

	if err := s.store.AddTagsToDocument(ctx, docPath, tagNames); err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"docPath": docPath,
			"tags":    tagNames,
		}).Error("failed to update tag index")
		return fmt.Errorf("updating tag index: %w", err)
	}

	s.emitEvent(events.DocumentTagsUpdated, map[string]any{
		"path": docPath,
		"tags": tagNames,
	})

	logger.WithFields(logrus.Fields{
		"docPath": docPath,
		"tags":    tagNames,
	}).Info("tags added to document")

	return nil
}

func (s *Service) RemoveTagsFromDocument(
	ctx context.Context,
	docPath string,
	tagNames []string,
) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	if len(tagNames) == 0 {
		return fmt.Errorf("at least one tag name is required")
	}

	err := s.fm.UpdateFile(docPath, func(doc *document.DocumentFile) error {
		toRemove := make(map[string]bool)
		for _, tag := range tagNames {
			toRemove[tag] = true
		}

		filtered := make([]string, 0, len(doc.Meta.Tags))
		for _, tag := range doc.Meta.Tags {
			if !toRemove[tag] {
				filtered = append(filtered, tag)
			}
		}
		doc.Meta.Tags = filtered
		return nil
	})
	if err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"docPath": docPath,
			"tags":    tagNames,
		}).Error("failed to update document file")
		return fmt.Errorf("updating document file: %w", err)
	}

	if err := s.store.RemoveTagsFromDocument(ctx, docPath, tagNames); err != nil {
		logger.WithError(err).WithFields(logrus.Fields{
			"docPath": docPath,
			"tags":    tagNames,
		}).Error("failed to update tag index")
		return fmt.Errorf("updating tag index: %w", err)
	}

	s.emitEvent(events.DocumentTagsUpdated, map[string]any{
		"path": docPath,
		"tags": tagNames,
	})

	logger.WithFields(logrus.Fields{
		"docPath": docPath,
		"tags":    tagNames,
	}).Info("tags removed from document")

	return nil
}

func (s *Service) RemoveAllDocumentTags(ctx context.Context, docPath string) error {
	if docPath == "" {
		return fmt.Errorf("document path is required")
	}

	err := s.fm.UpdateFile(docPath, func(doc *document.DocumentFile) error {
		doc.Meta.Tags = []string{}
		return nil
	})
	if err != nil {
		logger.WithError(err).WithField("docPath", docPath).Error("failed to update document file")
		return fmt.Errorf("updating document file: %w", err)
	}

	if err := s.store.RemoveAllDocumentTags(ctx, docPath); err != nil {
		logger.WithError(err).WithField("docPath", docPath).Error("failed to update tag index")
		return fmt.Errorf("updating tag index: %w", err)
	}

	s.emitEvent(events.DocumentTagsUpdated, map[string]any{
		"path": docPath,
		"tags": []string{},
	})

	logger.WithField("docPath", docPath).Info("all tags removed from document")

	return nil
}

func (s *Service) GetDocumentTags(ctx context.Context, docPath string) ([]string, error) {
	if docPath == "" {
		return nil, fmt.Errorf("document path is required")
	}

	tags, err := s.store.GetDocumentTags(ctx, docPath)
	if err != nil {
		logger.WithError(err).WithField("docPath", docPath).Error("failed to get document tags")
		return nil, fmt.Errorf("getting document tags: %w", err)
	}

	tagNames := make([]string, len(tags))
	for i, tag := range tags {
		tagNames[i] = tag.Name
	}

	return tagNames, nil
}
