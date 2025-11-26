package asset

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"yanta/internal/git"
	"yanta/internal/logger"
)

type Service struct {
	db            *sql.DB
	store         *Store
	vault         VaultProvider
	syncManager   *git.SyncManager
	uploadManager *ChunkedUploadManager
}

type ServiceConfig struct {
	DB          *sql.DB
	Store       *Store
	Vault       VaultProvider
	SyncManager *git.SyncManager
}

func NewService(cfg ServiceConfig) *Service {
	return &Service{
		db:            cfg.DB,
		store:         cfg.Store,
		vault:         cfg.Vault,
		syncManager:   cfg.SyncManager,
		uploadManager: NewChunkedUploadManager(DefaultSessionTimeout),
	}
}

func (s *Service) Upload(ctx context.Context, projectAlias string, data []byte, filename string) (*AssetInfo, error) {
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
		logger.WithError(err).WithFields(map[string]any{
			"project": projectAlias,
			"ext":     ext,
		}).Error("failed to write asset file")
		return nil, err
	}

	logger.WithFields(map[string]any{
		"hash": info.Hash,
		"ext":  info.Ext,
	}).Info("asset file written successfully")

	a := &Asset{
		Hash:      info.Hash,
		Ext:       info.Ext,
		Bytes:     info.Bytes,
		MIME:      info.MIME,
		CreatedAt: time.Now(),
	}

	if _, err := s.store.Upsert(ctx, a); err != nil {
		logger.WithError(err).WithField("hash", info.Hash).Error("failed to insert asset into database")
		return nil, err
	}

	logger.WithField("hash", info.Hash).Info("asset inserted into database successfully")

	s.syncManager.NotifyChange(fmt.Sprintf("uploaded asset %s%s", info.Hash, info.Ext))

	return info, nil
}

func (s *Service) BuildURL(ctx context.Context, projectAlias, hash, ext string) (string, error) {
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

func (s *Service) LinkToDocument(ctx context.Context, docPath, hash string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	return s.store.LinkToDocument(ctx, hash, docPath)
}

func (s *Service) UnlinkFromDocument(ctx context.Context, docPath, hash string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	if err := ValidateHash(hash); err != nil {
		return fmt.Errorf("invalid hash: %w", err)
	}

	return s.store.UnlinkFromDocument(ctx, hash, docPath)
}

func (s *Service) UnlinkAllFromDocument(ctx context.Context, docPath string) error {
	if s.store == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(docPath) == "" {
		return fmt.Errorf("document path is required")
	}

	return s.store.UnlinkAllFromDocument(ctx, docPath)
}

func (s *Service) CleanupOrphans(ctx context.Context, projectAlias string) (int, error) {
	if s.store == nil {
		return 0, fmt.Errorf("service not initialised correctly")
	}

	orphans, err := s.store.GetOrphanedAssets(ctx)
	if err != nil {
		return 0, fmt.Errorf("getting orphaned assets: %w", err)
	}

	if len(orphans) == 0 {
		return 0, nil
	}

	deleted := 0
	for _, a := range orphans {
		if err := s.store.Delete(ctx, a.Hash); err != nil {
			continue
		}
		deleted++

		if projectAlias != "" && s.vault != nil {
			_ = DeleteAsset(s.vault, projectAlias, a.Hash, a.Ext)
		}
	}

	if deleted > 0 {
		s.syncManager.NotifyChange(fmt.Sprintf("cleaned up %d orphaned assets", deleted))
	}

	return deleted, nil
}

func (s *Service) StartChunkedUpload(ctx context.Context, req StartChunkedUploadRequest) (*StartChunkedUploadResponse, error) {
	if s.uploadManager == nil {
		return nil, fmt.Errorf("service not initialised correctly")
	}

	uploadID, err := s.uploadManager.CreateSession(req)
	if err != nil {
		logger.WithError(err).WithFields(map[string]any{
			"project":  req.ProjectAlias,
			"filename": req.Filename,
			"size":     req.TotalSize,
		}).Error("failed to start chunked upload")
		return nil, err
	}

	logger.WithFields(map[string]any{
		"uploadId":    uploadID,
		"project":     req.ProjectAlias,
		"filename":    req.Filename,
		"totalSize":   req.TotalSize,
		"totalChunks": req.TotalChunks,
	}).Debug("chunked upload session started")

	return &StartChunkedUploadResponse{UploadID: uploadID}, nil
}

func (s *Service) UploadChunk(ctx context.Context, req UploadChunkRequest) (*UploadChunkResponse, error) {
	if s.uploadManager == nil {
		return nil, fmt.Errorf("service not initialised correctly")
	}

	receivedCount, complete, err := s.uploadManager.AddChunk(req.UploadID, req.ChunkIndex, req.Data)
	if err != nil {
		logger.WithError(err).WithFields(map[string]any{
			"uploadId":   req.UploadID,
			"chunkIndex": req.ChunkIndex,
		}).Error("failed to upload chunk")
		return nil, err
	}

	logger.WithFields(map[string]any{
		"uploadId":       req.UploadID,
		"chunkIndex":     req.ChunkIndex,
		"receivedChunks": receivedCount,
		"complete":       complete,
	}).Debug("chunk received")

	return &UploadChunkResponse{
		ReceivedChunks: receivedCount,
		Complete:       complete,
	}, nil
}

func (s *Service) FinalizeChunkedUpload(ctx context.Context, uploadID string) (*FinalizeChunkedUploadResponse, error) {
	if s.uploadManager == nil || s.vault == nil || s.store == nil {
		return nil, fmt.Errorf("service not initialised correctly")
	}

	data, session, err := s.uploadManager.AssembleAndRemove(uploadID)
	if err != nil {
		logger.WithError(err).WithField("uploadId", uploadID).Error("failed to assemble chunks")
		return nil, err
	}

	ext := session.GetExtension()
	info, err := s.Upload(ctx, session.projectAlias, data, session.filename)
	if err != nil {
		logger.WithError(err).WithFields(map[string]any{
			"uploadId": uploadID,
			"project":  session.projectAlias,
		}).Error("failed to finalize chunked upload")
		return nil, err
	}

	url, err := s.BuildURL(ctx, session.projectAlias, info.Hash, ext)
	if err != nil {
		return nil, fmt.Errorf("building asset URL: %w", err)
	}

	logger.WithFields(map[string]any{
		"uploadId": uploadID,
		"hash":     info.Hash,
		"ext":      info.Ext,
		"bytes":    info.Bytes,
		"url":      url,
	}).Info("chunked upload finalized successfully")

	return &FinalizeChunkedUploadResponse{
		URL:   url,
		Hash:  info.Hash,
		Ext:   info.Ext,
		Bytes: info.Bytes,
	}, nil
}

func (s *Service) AbortChunkedUpload(ctx context.Context, uploadID string) error {
	if s.uploadManager == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	err := s.uploadManager.RemoveSession(uploadID)
	if err != nil {
		logger.WithError(err).WithField("uploadId", uploadID).Error("failed to abort chunked upload")
		return err
	}

	logger.WithField("uploadId", uploadID).Debug("chunked upload aborted")
	return nil
}
