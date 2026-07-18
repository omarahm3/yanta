package asset

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yanta/internal/git"
	"yanta/internal/logger"
	"yanta/internal/project"
)

// MaxAssetBytes bounds a single decoded asset payload (matches Upload's cap).
const MaxAssetBytes int64 = 10 * 1024 * 1024 // 10MB

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

	if err := project.ValidateAlias(strings.TrimSpace(projectAlias)); err != nil {
		return nil, fmt.Errorf("invalid project alias: %w", err)
	}

	if int64(len(data)) <= 0 {
		return nil, fmt.Errorf("file is empty")
	}
	if int64(len(data)) > MaxAssetBytes {
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
		// Roll back the just-written file so it doesn't linger untracked (with no
		// DB row, CleanupOrphans can never reclaim it). Skip if the bytes were
		// already on disk from a prior store — another row may reference them.
		if !info.AlreadyExist {
			_ = DeleteAsset(s.vault, projectAlias, info.Hash, info.Ext)
		}
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
		// Remove the vault file(s) BEFORE the DB row: if the row delete then fails,
		// the next cleanup simply retries (the file is already gone, a no-op) — far
		// safer than dropping the row first and leaking a file with nothing left to
		// find it by.
		if !s.deleteOrphanFiles(projectAlias, a.Hash, a.Ext) {
			// A physical copy couldn't be removed (locked/permission-denied).
			// Keep the DB row so a later cleanup can retry rather than deleting
			// the row and orphaning the file on disk forever.
			logger.WithField("hash", a.Hash).Warn("keeping orphaned asset row; file removal incomplete")
			continue
		}

		if err := s.store.Delete(ctx, a.Hash); err != nil {
			logger.WithError(err).WithField("hash", a.Hash).Warn("failed to delete orphaned asset row")
			continue
		}
		deleted++
	}

	if deleted > 0 {
		s.syncManager.NotifyChange(fmt.Sprintf("cleaned up %d orphaned assets", deleted))
	}

	return deleted, nil
}

// deleteOrphanFiles removes an orphaned asset's file from the caller's project
// and from every other project dir. The asset table dedups to one row per hash,
// but each project keeps its own physical copy; once that shared row is gone,
// copies under other projects would leak with no row to reclaim them.
//
// Returns true only when every physical copy was removed (or was already
// absent). On false the caller keeps the DB row so a locked/permission-denied
// file gets retried on a later cleanup instead of being orphaned forever.
func (s *Service) deleteOrphanFiles(projectAlias, hash, ext string) bool {
	if s.vault == nil {
		return false
	}
	allRemoved := true
	if projectAlias != "" {
		if err := DeleteAsset(s.vault, projectAlias, hash, ext); err != nil {
			// A missing file is fine — there's nothing left to leak. Any other
			// failure (locked/permission) means a real copy may still be on disk,
			// so signal the caller to keep the row for a later retry.
			if exists, _ := AssetExists(s.vault, projectAlias, hash, ext); exists {
				allRemoved = false
			}
		}
	}
	// Sweep the remaining project dirs. Requires a concrete vault exposing its
	// root (real *vault.Vault does; test mocks may not — they only need the
	// per-project delete above).
	rp, hasRoot := s.vault.(interface{ RootPath() string })
	if !hasRoot {
		return allRemoved
	}
	if err := ValidateHash(hash); err != nil {
		return false
	}
	if ext != "" {
		if err := ValidateExtension(ext); err != nil {
			return false
		}
	}
	// Read the projects dir directly rather than globbing: filepath.Glob would
	// misparse a RootPath() that contains glob metacharacters (e.g. "[" or "]").
	// hash/ext are already validated above, so the per-project path is literal.
	projectsDir := filepath.Join(rp.RootPath(), "projects")
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		// An absent projects dir means no other copies exist; any other error
		// means we couldn't verify, so keep the row to be safe.
		if os.IsNotExist(err) {
			return allRemoved
		}
		return false
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		m := filepath.Join(projectsDir, entry.Name(), "assets", hash+ext)
		if _, err := os.Stat(m); err == nil {
			if err := os.Remove(m); err != nil {
				allRemoved = false
			}
		}
	}
	return allRemoved
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

// StoreDataURL stores image data from a dataURL as a vault asset and returns
// a reference in the format "/assets/{projectAlias}/{hash}{ext}" (matching the
// existing asset URL scheme used by image blocks).
func (s *Service) StoreDataURL(ctx context.Context, projectAlias string, dataURL string) (string, error) {
	if s.vault == nil || s.store == nil || s.db == nil {
		return "", fmt.Errorf("service not initialised correctly")
	}

	if err := project.ValidateAlias(strings.TrimSpace(projectAlias)); err != nil {
		return "", fmt.Errorf("invalid project alias: %w", err)
	}

	// Bound the encoded payload before decoding so an oversized dataURL can't
	// balloon memory during base64 decode (a ~4/3 blowup of an already-huge
	// string). The decoded bytes are re-checked below against the same cap.
	if int64(len(dataURL)) > MaxAssetBytes*2 {
		return "", fmt.Errorf("dataURL too large: max 10MB")
	}

	mimeType, data, err := ParseDataURL(dataURL)
	if err != nil {
		return "", fmt.Errorf("parsing dataURL: %w", err)
	}

	if int64(len(data)) <= 0 {
		return "", fmt.Errorf("image data is empty")
	}
	if int64(len(data)) > MaxAssetBytes {
		return "", fmt.Errorf("image too large: max 10MB")
	}

	ext := MIMEToExtension(mimeType)
	if ext == "" {
		return "", fmt.Errorf("unsupported MIME type: %s", mimeType)
	}

	info, err := WriteAsset(s.vault, projectAlias, data, ext)
	if err != nil {
		return "", fmt.Errorf("writing asset: %w", err)
	}

	a := &Asset{
		Hash:      info.Hash,
		Ext:       info.Ext,
		Bytes:     info.Bytes,
		MIME:      info.MIME,
		CreatedAt: time.Now(),
	}

	if _, err := s.store.Upsert(ctx, a); err != nil {
		if !info.AlreadyExist {
			_ = DeleteAsset(s.vault, projectAlias, info.Hash, info.Ext)
		}
		return "", fmt.Errorf("inserting asset into database: %w", err)
	}

	s.syncManager.NotifyChange(fmt.Sprintf("stored canvas asset %s%s", info.Hash, info.Ext))

	// Return the existing asset URL scheme so the indexer's linker can parse it
	return fmt.Sprintf("/assets/%s/%s%s", projectAlias, info.Hash, info.Ext), nil
}

// ResolveDataURL converts an asset reference back to a dataURL.
// The reference can be in the format "/assets/{projectAlias}/{hash}{ext}".
func (s *Service) ResolveDataURL(ctx context.Context, projectAlias string, ref string) (string, error) {
	if s.vault == nil {
		return "", fmt.Errorf("service not initialised correctly")
	}

	// Validate the alias (not just non-empty): AssetsPath joins it into the vault
	// path unchecked, so a traversal alias like "@x/../../.." would otherwise let
	// a crafted ref read files outside the vault.
	if err := project.ValidateAlias(strings.TrimSpace(projectAlias)); err != nil {
		return "", fmt.Errorf("invalid project alias: %w", err)
	}

	// Parse "/assets/{projectAlias}/{hash}{ext}" format
	hash, ext, err := ParseAssetRef(ref)
	if err != nil {
		return "", fmt.Errorf("parsing asset reference: %w", err)
	}

	data, err := ReadAsset(s.vault, projectAlias, hash, ext)
	if err != nil {
		return "", fmt.Errorf("reading asset: %w", err)
	}

	mime := DetectMIME(ext)
	return EncodeDataURL(mime, data), nil
}
