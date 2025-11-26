package asset

import (
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const DefaultSessionTimeout = 5 * time.Minute

type StartChunkedUploadRequest struct {
	ProjectAlias string `json:"projectAlias"`
	Filename     string `json:"filename"`
	TotalSize    int64  `json:"totalSize"`
	TotalChunks  int    `json:"totalChunks"`
	MimeType     string `json:"mimeType"`
}

type StartChunkedUploadResponse struct {
	UploadID string `json:"uploadId"`
}

type UploadChunkRequest struct {
	UploadID   string `json:"uploadId"`
	ChunkIndex int    `json:"chunkIndex"`
	Data       string `json:"data"`
}

type UploadChunkResponse struct {
	ReceivedChunks int  `json:"receivedChunks"`
	Complete       bool `json:"complete"`
}

type FinalizeChunkedUploadResponse struct {
	URL   string `json:"url"`
	Hash  string `json:"hash"`
	Ext   string `json:"ext"`
	Bytes int64  `json:"bytes"`
}

type uploadSession struct {
	projectAlias string
	filename     string
	mimeType     string
	totalSize    int64
	totalChunks  int
	chunks       map[int][]byte
	mu           sync.Mutex
	createdAt    time.Time
	lastActivity time.Time
}

type ChunkedUploadManager struct {
	sessions       sync.Map
	sessionTimeout time.Duration
	stopCleanup    chan struct{}
	cleanupDone    chan struct{}
}

func NewChunkedUploadManager(timeout time.Duration) *ChunkedUploadManager {
	if timeout == 0 {
		timeout = DefaultSessionTimeout
	}

	mgr := &ChunkedUploadManager{
		sessionTimeout: timeout,
		stopCleanup:    make(chan struct{}),
		cleanupDone:    make(chan struct{}),
	}

	go mgr.cleanupLoop()

	return mgr
}

func (m *ChunkedUploadManager) cleanupLoop() {
	defer close(m.cleanupDone)

	ticker := time.NewTicker(m.sessionTimeout / 2)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopCleanup:
			return
		case <-ticker.C:
			m.cleanupExpiredSessions()
		}
	}
}

func (m *ChunkedUploadManager) cleanupExpiredSessions() {
	now := time.Now()
	m.sessions.Range(func(key, value any) bool {
		session := value.(*uploadSession)
		session.mu.Lock()
		expired := now.Sub(session.lastActivity) > m.sessionTimeout
		session.mu.Unlock()

		if expired {
			m.sessions.Delete(key)
		}
		return true
	})
}

func (m *ChunkedUploadManager) Shutdown() {
	close(m.stopCleanup)
	<-m.cleanupDone
}

func (m *ChunkedUploadManager) CreateSession(req StartChunkedUploadRequest) (string, error) {
	if strings.TrimSpace(req.ProjectAlias) == "" {
		return "", fmt.Errorf("project alias is required")
	}
	if req.TotalSize <= 0 {
		return "", fmt.Errorf("total size must be greater than 0")
	}
	if req.TotalSize > MaxUploadSize {
		return "", fmt.Errorf("file too large: max %dMB", MaxUploadSize/(1024*1024))
	}
	if req.TotalChunks <= 0 {
		return "", fmt.Errorf("total chunks must be greater than 0")
	}

	uploadID := uuid.New().String()
	now := time.Now()

	session := &uploadSession{
		projectAlias: req.ProjectAlias,
		filename:     req.Filename,
		mimeType:     req.MimeType,
		totalSize:    req.TotalSize,
		totalChunks:  req.TotalChunks,
		chunks:       make(map[int][]byte),
		createdAt:    now,
		lastActivity: now,
	}

	m.sessions.Store(uploadID, session)

	return uploadID, nil
}

func (m *ChunkedUploadManager) AddChunk(uploadID string, chunkIndex int, base64Data string) (int, bool, error) {
	val, ok := m.sessions.Load(uploadID)
	if !ok {
		return 0, false, fmt.Errorf("upload session not found: %s", uploadID)
	}

	session := val.(*uploadSession)
	session.mu.Lock()
	defer session.mu.Unlock()

	if chunkIndex < 0 || chunkIndex >= session.totalChunks {
		return 0, false, fmt.Errorf("chunk index out of range: %d (expected 0-%d)", chunkIndex, session.totalChunks-1)
	}

	if _, exists := session.chunks[chunkIndex]; exists {
		return 0, false, fmt.Errorf("chunk %d already received", chunkIndex)
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return 0, false, fmt.Errorf("invalid base64 data: %w", err)
	}

	session.chunks[chunkIndex] = data
	session.lastActivity = time.Now()

	receivedCount := len(session.chunks)
	complete := receivedCount == session.totalChunks

	return receivedCount, complete, nil
}

func (m *ChunkedUploadManager) AssembleAndRemove(uploadID string) ([]byte, *uploadSession, error) {
	val, ok := m.sessions.Load(uploadID)
	if !ok {
		return nil, nil, fmt.Errorf("upload session not found: %s", uploadID)
	}

	session := val.(*uploadSession)
	session.mu.Lock()
	defer session.mu.Unlock()

	if len(session.chunks) != session.totalChunks {
		missing := make([]int, 0)
		for i := 0; i < session.totalChunks; i++ {
			if _, ok := session.chunks[i]; !ok {
				missing = append(missing, i)
			}
		}
		return nil, nil, fmt.Errorf("missing chunks: %v (received %d of %d)", missing, len(session.chunks), session.totalChunks)
	}

	var totalSize int
	for _, chunk := range session.chunks {
		totalSize += len(chunk)
	}

	assembled := make([]byte, 0, totalSize)
	for i := 0; i < session.totalChunks; i++ {
		assembled = append(assembled, session.chunks[i]...)
	}

	m.sessions.Delete(uploadID)

	return assembled, session, nil
}

func (m *ChunkedUploadManager) RemoveSession(uploadID string) error {
	_, ok := m.sessions.Load(uploadID)
	if !ok {
		return fmt.Errorf("upload session not found: %s", uploadID)
	}

	m.sessions.Delete(uploadID)
	return nil
}

func (s *uploadSession) GetExtension() string {
	ext := NormalizeExtension(filepath.Ext(s.filename))
	if ext == "" {
		ext = mimeToExt(s.mimeType)
	}
	return ext
}

func mimeToExt(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}
