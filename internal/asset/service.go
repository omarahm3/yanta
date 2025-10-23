package asset

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

// Service provides high-level asset operations for the frontend.
type Service struct {
	db    *sql.DB
	store *Store
	vault VaultProvider

	ctx context.Context
}

type ServiceConfig struct {
	DB    *sql.DB
	Store *Store
	Vault VaultProvider
}

func NewService(cfg ServiceConfig) *Service {
	return &Service{
		db:    cfg.DB,
		store: cfg.Store,
		vault: cfg.Vault,
	}
}

func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// Upload validates and stores an image asset (max 10MB).
func (s *Service) Upload(projectAlias string, data []byte, filename string) (*AssetInfo, error) {
	if s.vault == nil || s.store == nil || s.db == nil {
		return nil, fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(projectAlias) == "" {
		return nil, fmt.Errorf("project alias is required")
	}

	const maxBytes int64 = 10 * 1024 * 1024 // 10MB
	if int64(len(data)) <= 0 {
		return nil, fmt.Errorf("file is empty")
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("file too large: max 10MB")
	}

	ext := NormalizeExtension(filepath.Ext(filename))
	allowed := map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".webp": true, ".gif": true}
	if !allowed[strings.ToLower(ext)] {
		if mt := detectImageExt(data); mt != "" && allowed[mt] {
			ext = mt
		} else {
			return nil, fmt.Errorf("unsupported image type: %s", ext)
		}
	}

	info, err := WriteAsset(s.vault, projectAlias, data, ext)
	if err != nil {
		return nil, err
	}

	a := &Asset{
		Hash:      info.Hash,
		Ext:       info.Ext,
		Bytes:     info.Bytes,
		MIME:      info.MIME,
		CreatedAt: time.Now(),
	}

	if _, err := s.store.Upsert(s.ctxOrBG(), a); err != nil {
		return nil, err
	}

	return info, nil
}

// BuildURL constructs the asset URL for the frontend editor.
func (s *Service) BuildURL(projectAlias, hash, ext string) (string, error) {
	if err := ValidateHash(hash); err != nil {
		return "", err
	}
	if err := ValidateExtension(ext); err != nil {
		return "", err
	}
	if strings.TrimSpace(projectAlias) == "" {
		return "", fmt.Errorf("project alias is required")
	}
	return "/assets/" + projectAlias + "/" + hash + ext, nil
}

// LinkToDocument associates an asset with a document for garbage collection tracking.
func (s *Service) LinkToDocument(docPath, hash string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	return s.store.LinkToDocument(s.ctxOrBG(), hash, docPath)
}

// UnlinkFromDocument removes the asset-document association.
func (s *Service) UnlinkFromDocument(docPath, hash string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	return s.store.UnlinkFromDocument(s.ctxOrBG(), hash, docPath)
}

// UnlinkAllFromDocument removes all asset associations when a document is deleted.
func (s *Service) UnlinkAllFromDocument(docPath string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	return s.store.UnlinkAllFromDocument(s.ctxOrBG(), docPath)
}

func (s *Service) CleanupOrphans(projectAlias string) (int, error) {
	if s.store == nil {
		return 0, fmt.Errorf("service not initialised correctly")
	}

	orphans, err := s.store.GetOrphanedAssets(s.ctxOrBG())
	if err != nil {
		return 0, fmt.Errorf("getting orphaned assets: %w", err)
	}

	if len(orphans) == 0 {
		return 0, nil
	}

	deleted := 0
	for _, a := range orphans {
		if err := s.store.Delete(s.ctxOrBG(), a.Hash); err != nil {
			continue
		}
		deleted++

		if projectAlias != "" && s.vault != nil {
			_ = DeleteAsset(s.vault, projectAlias, a.Hash, a.Ext)
		}
	}

	return deleted, nil
}

func (s *Service) ctxOrBG() context.Context {
	if s.ctx != nil {
		return s.ctx
	}
	return context.Background()
}
