package asset

import (
	"context"
	"encoding/base64"
	"sync"
	"testing"
	"time"

	"yanta/internal/git"
	"yanta/internal/testutil"
)

func TestStartChunkedUpload_ValidRequest(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	req := StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    1024,
		TotalChunks:  4,
		MimeType:     "image/png",
	}

	resp, err := svc.StartChunkedUpload(ctx, req)
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	if resp.UploadID == "" {
		t.Error("Expected non-empty upload ID")
	}
}

func TestStartChunkedUpload_InvalidProject(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	req := StartChunkedUploadRequest{
		ProjectAlias: "",
		Filename:     "image.png",
		TotalSize:    1024,
		TotalChunks:  4,
		MimeType:     "image/png",
	}

	_, err := svc.StartChunkedUpload(ctx, req)
	if err == nil {
		t.Error("Expected error for empty project alias")
	}
}

func TestStartChunkedUpload_ZeroSize(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	req := StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    0,
		TotalChunks:  0,
		MimeType:     "image/png",
	}

	_, err := svc.StartChunkedUpload(ctx, req)
	if err == nil {
		t.Error("Expected error for zero size")
	}
}

func TestStartChunkedUpload_ExceedsMaxSize(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	req := StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    11 * 1024 * 1024, // 11MB, exceeds 10MB limit
		TotalChunks:  44,
		MimeType:     "image/png",
	}

	_, err := svc.StartChunkedUpload(ctx, req)
	if err == nil {
		t.Error("Expected error for file exceeding max size")
	}
}

func TestUploadChunk_ValidChunk(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  2,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	chunkData := make([]byte, 50)
	for i := range chunkData {
		chunkData[i] = byte(i)
	}

	resp, err := svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString(chunkData),
	})
	if err != nil {
		t.Fatalf("UploadChunk failed: %v", err)
	}

	if resp.ReceivedChunks != 1 {
		t.Errorf("Expected 1 received chunk, got %d", resp.ReceivedChunks)
	}
	if resp.Complete {
		t.Error("Expected Complete to be false after first chunk")
	}
}

func TestUploadChunk_InvalidUploadID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	_, err := svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   "nonexistent-id",
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString([]byte("data")),
	})

	if err == nil {
		t.Error("Expected error for invalid upload ID")
	}
}

func TestUploadChunk_DuplicateChunk(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  2,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	chunkData := base64.StdEncoding.EncodeToString([]byte("chunk0"))

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       chunkData,
	})
	if err != nil {
		t.Fatalf("First UploadChunk failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       chunkData,
	})
	if err == nil {
		t.Error("Expected error for duplicate chunk")
	}
}

func TestUploadChunk_OutOfOrderChunks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    150,
		TotalChunks:  3,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 2,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk2")),
	})
	if err != nil {
		t.Fatalf("UploadChunk (index 2) failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk0")),
	})
	if err != nil {
		t.Fatalf("UploadChunk (index 0) failed: %v", err)
	}

	resp, err := svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 1,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk1")),
	})
	if err != nil {
		t.Fatalf("UploadChunk (index 1) failed: %v", err)
	}

	if resp.ReceivedChunks != 3 {
		t.Errorf("Expected 3 received chunks, got %d", resp.ReceivedChunks)
	}
	if !resp.Complete {
		t.Error("Expected Complete to be true after all chunks")
	}
}

func TestUploadChunk_InvalidBase64(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  1,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       "not-valid-base64!!!",
	})
	if err == nil {
		t.Error("Expected error for invalid base64 data")
	}
}

func TestUploadChunk_ChunkIndexOutOfRange(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  2,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 5,
		Data:       base64.StdEncoding.EncodeToString([]byte("data")),
	})
	if err == nil {
		t.Error("Expected error for chunk index out of range")
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: -1,
		Data:       base64.StdEncoding.EncodeToString([]byte("data")),
	})
	if err == nil {
		t.Error("Expected error for negative chunk index")
	}
}

func TestFinalizeChunkedUpload_AllChunksReceived(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := &testVault{root: t.TempDir()}
	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	chunk0 := []byte("first chunk data!")
	chunk1 := []byte("second chunk!")

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    int64(len(chunk0) + len(chunk1)),
		TotalChunks:  2,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString(chunk0),
	})
	if err != nil {
		t.Fatalf("UploadChunk 0 failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 1,
		Data:       base64.StdEncoding.EncodeToString(chunk1),
	})
	if err != nil {
		t.Fatalf("UploadChunk 1 failed: %v", err)
	}

	resp, err := svc.FinalizeChunkedUpload(ctx, startResp.UploadID)
	if err != nil {
		t.Fatalf("FinalizeChunkedUpload failed: %v", err)
	}

	if resp.URL == "" {
		t.Error("Expected non-empty URL")
	}
	if resp.Hash == "" {
		t.Error("Expected non-empty hash")
	}
	if resp.Ext != ".png" {
		t.Errorf("Expected .png extension, got %s", resp.Ext)
	}
	if resp.Bytes != int64(len(chunk0)+len(chunk1)) {
		t.Errorf("Expected %d bytes, got %d", len(chunk0)+len(chunk1), resp.Bytes)
	}
}

func TestFinalizeChunkedUpload_MissingChunks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  3,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk0")),
	})
	if err != nil {
		t.Fatalf("UploadChunk failed: %v", err)
	}

	_, err = svc.FinalizeChunkedUpload(ctx, startResp.UploadID)
	if err == nil {
		t.Error("Expected error for missing chunks")
	}
}

func TestFinalizeChunkedUpload_InvalidUploadID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	_, err := svc.FinalizeChunkedUpload(ctx, "nonexistent-id")
	if err == nil {
		t.Error("Expected error for invalid upload ID")
	}
}

func TestAbortChunkedUpload_ActiveSession(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
		ProjectAlias: "@test",
		Filename:     "image.png",
		TotalSize:    100,
		TotalChunks:  2,
		MimeType:     "image/png",
	})
	if err != nil {
		t.Fatalf("StartChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 0,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk0")),
	})
	if err != nil {
		t.Fatalf("UploadChunk failed: %v", err)
	}

	err = svc.AbortChunkedUpload(ctx, startResp.UploadID)
	if err != nil {
		t.Fatalf("AbortChunkedUpload failed: %v", err)
	}

	_, err = svc.UploadChunk(ctx, UploadChunkRequest{
		UploadID:   startResp.UploadID,
		ChunkIndex: 1,
		Data:       base64.StdEncoding.EncodeToString([]byte("chunk1")),
	})
	if err == nil {
		t.Error("Expected error when uploading to aborted session")
	}
}

func TestAbortChunkedUpload_NonexistentSession(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       &testVault{root: t.TempDir()},
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	err := svc.AbortChunkedUpload(ctx, "nonexistent-id")
	if err == nil {
		t.Error("Expected error for nonexistent session")
	}
}

func TestChunkedUpload_ConcurrentSessions(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := &testVault{root: t.TempDir()}
	svc := NewService(ServiceConfig{
		DB:          db,
		Store:       NewStore(db),
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()
	var wg sync.WaitGroup
	errors := make(chan error, 10)

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			startResp, err := svc.StartChunkedUpload(ctx, StartChunkedUploadRequest{
				ProjectAlias: "@test",
				Filename:     "image.png",
				TotalSize:    20,
				TotalChunks:  2,
				MimeType:     "image/png",
			})
			if err != nil {
				errors <- err
				return
			}

			chunk := []byte("0123456789")
			_, err = svc.UploadChunk(ctx, UploadChunkRequest{
				UploadID:   startResp.UploadID,
				ChunkIndex: 0,
				Data:       base64.StdEncoding.EncodeToString(chunk),
			})
			if err != nil {
				errors <- err
				return
			}

			_, err = svc.UploadChunk(ctx, UploadChunkRequest{
				UploadID:   startResp.UploadID,
				ChunkIndex: 1,
				Data:       base64.StdEncoding.EncodeToString(chunk),
			})
			if err != nil {
				errors <- err
				return
			}

			_, err = svc.FinalizeChunkedUpload(ctx, startResp.UploadID)
			if err != nil {
				errors <- err
				return
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		t.Errorf("Concurrent upload error: %v", err)
	}
}

func TestChunkedUploadManager_SessionCleanup(t *testing.T) {
	mgr := NewChunkedUploadManager(100 * time.Millisecond)
	defer mgr.Shutdown()

	session := &uploadSession{
		projectAlias: "@test",
		filename:     "test.png",
		totalSize:    100,
		totalChunks:  2,
		chunks:       make(map[int][]byte),
		createdAt:    time.Now(),
		lastActivity: time.Now(),
	}

	mgr.sessions.Store("test-id", session)

	time.Sleep(250 * time.Millisecond)

	_, ok := mgr.sessions.Load("test-id")
	if ok {
		t.Error("Expected session to be cleaned up after timeout")
	}
}
