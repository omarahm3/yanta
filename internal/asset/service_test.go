package asset

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
	"yanta/internal/git"
	"yanta/internal/testutil"
)

type testVault struct{ root string }

func (v *testVault) AssetsPath(projectAlias string) string {
	return filepath.Join(v.root, "projects", projectAlias, "assets")
}

func (v *testVault) EnsureProjectDir(projectAlias string) error {
	return os.MkdirAll(v.AssetsPath(projectAlias), 0755)
}

func TestService_Upload_Success(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	s := NewStore(db)
	v := &testVault{root: t.TempDir()}

	svc := NewService(ServiceConfig{DB: db, Store: s, Vault: v, SyncManager: git.NewMockSyncManager()})

	data := []byte("fakepngdata")
	info, err := svc.Upload("@proj", data, "image.png")
	if err != nil {
		t.Fatalf("Upload failed: %v", err)
	}
	if info.Hash == "" || info.Ext != ".png" || info.Bytes != int64(len(data)) {
		t.Fatalf("unexpected info: %+v", info)
	}

	// Verify DB row exists
	got, err := s.GetByHash(context.Background(), info.Hash)
	if err != nil {
		t.Fatalf("GetByHash failed: %v", err)
	}
	if got.MIME != "image/png" || got.Ext != ".png" || got.Bytes != int64(len(data)) {
		t.Fatalf("unexpected stored asset: %+v", got)
	}
}

func TestService_BuildURL(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	svc := NewService(ServiceConfig{DB: db, Store: NewStore(db), Vault: &testVault{root: t.TempDir()}, SyncManager: git.NewMockSyncManager()})
	url, err := svc.BuildURL("@p", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", ".jpg")
	if err != nil {
		t.Fatalf("BuildURL error: %v", err)
	}
	if url != "/assets/@p/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg" {
		t.Fatalf("unexpected url: %s", url)
	}
}

func TestService_Upload_TooLarge(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	s := NewStore(db)
	v := &testVault{root: t.TempDir()}
	svc := NewService(ServiceConfig{DB: db, Store: s, Vault: v, SyncManager: git.NewMockSyncManager()})

	// 10MB + 1 byte
	big := make([]byte, 10*1024*1024+1)
	for i := range big {
		big[i] = byte(i % 251)
	}

	if _, err := svc.Upload("@proj", big, "big.png"); err == nil {
		t.Fatalf("expected error for too large file")
	}
}

// helper to get a context with timeout in tests when needed
func testCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 2*time.Second)
}

func TestService_LinkToDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to setup test document: %v", err)
	}

	asset := &Asset{
		Hash:      ComputeHash([]byte("test asset")),
		Ext:       ".png",
		Bytes:     10,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Failed to create asset: %v", err)
	}

	err = service.LinkToDocument("projects/@test/doc-123.json", asset.Hash)
	if err != nil {
		t.Fatalf("LinkToDocument() failed: %v", err)
	}

	assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}

	if len(assets) != 1 {
		t.Fatalf("Expected 1 linked asset, got %d", len(assets))
	}

	if assets[0].Hash != asset.Hash {
		t.Errorf("Linked asset hash mismatch: got %s, want %s", assets[0].Hash, asset.Hash)
	}
}

func TestService_LinkToDocument_ValidationErrors(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	validHash := ComputeHash([]byte("test"))

	tests := []struct {
		name    string
		docPath string
		hash    string
		wantErr bool
	}{
		{
			name:    "empty document path",
			docPath: "",
			hash:    validHash,
			wantErr: true,
		},
		{
			name:    "whitespace document path",
			docPath: "   ",
			hash:    validHash,
			wantErr: true,
		},
		{
			name:    "invalid hash",
			docPath: "projects/@test/doc.json",
			hash:    "invalid",
			wantErr: true,
		},
		{
			name:    "hash too short",
			docPath: "projects/@test/doc.json",
			hash:    "abc123",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.LinkToDocument(tt.docPath, tt.hash)
			if (err != nil) != tt.wantErr {
				t.Errorf("LinkToDocument() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestService_LinkToDocument_NilStore(t *testing.T) {
	service := NewService(ServiceConfig{
		DB:          nil,
		Store:       nil,
		Vault:       nil,
		SyncManager: git.NewMockSyncManager(),
	})

	err := service.LinkToDocument("projects/@test/doc.json", ComputeHash([]byte("test")))
	if err == nil {
		t.Error("LinkToDocument() should fail with nil store")
	}
}

func TestService_UnlinkFromDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to setup test document: %v", err)
	}

	asset := &Asset{
		Hash:      ComputeHash([]byte("test asset")),
		Ext:       ".png",
		Bytes:     10,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Failed to create asset: %v", err)
	}

	err = service.LinkToDocument("projects/@test/doc-123.json", asset.Hash)
	if err != nil {
		t.Fatalf("LinkToDocument() failed: %v", err)
	}

	err = service.UnlinkFromDocument("projects/@test/doc-123.json", asset.Hash)
	if err != nil {
		t.Fatalf("UnlinkFromDocument() failed: %v", err)
	}

	assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}

	if len(assets) != 0 {
		t.Errorf("Expected 0 assets after unlink, got %d", len(assets))
	}
}

func TestService_UnlinkFromDocument_ValidationErrors(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	validHash := ComputeHash([]byte("test"))

	tests := []struct {
		name    string
		docPath string
		hash    string
		wantErr bool
	}{
		{
			name:    "empty document path",
			docPath: "",
			hash:    validHash,
			wantErr: true,
		},
		{
			name:    "whitespace document path",
			docPath: "   ",
			hash:    validHash,
			wantErr: true,
		},
		{
			name:    "invalid hash",
			docPath: "projects/@test/doc.json",
			hash:    "invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.UnlinkFromDocument(tt.docPath, tt.hash)
			if (err != nil) != tt.wantErr {
				t.Errorf("UnlinkFromDocument() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestService_UnlinkFromDocument_NilStore(t *testing.T) {
	service := NewService(ServiceConfig{
		DB:    nil,
		Store: nil,
		Vault: nil,
	})

	err := service.UnlinkFromDocument("projects/@test/doc.json", ComputeHash([]byte("test")))
	if err == nil {
		t.Error("UnlinkFromDocument() should fail with nil store")
	}
}

func TestService_UnlinkAllFromDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to setup test document: %v", err)
	}

	asset1 := &Asset{
		Hash:      ComputeHash([]byte("asset1")),
		Ext:       ".png",
		Bytes:     6,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	asset2 := &Asset{
		Hash:      ComputeHash([]byte("asset2")),
		Ext:       ".jpg",
		Bytes:     6,
		MIME:      "image/jpeg",
		CreatedAt: time.Now(),
	}

	_, err = store.Upsert(ctx, asset1)
	if err != nil {
		t.Fatalf("Failed to create asset1: %v", err)
	}
	_, err = store.Upsert(ctx, asset2)
	if err != nil {
		t.Fatalf("Failed to create asset2: %v", err)
	}

	err = service.LinkToDocument("projects/@test/doc-123.json", asset1.Hash)
	if err != nil {
		t.Fatalf("Failed to link asset1: %v", err)
	}
	err = service.LinkToDocument("projects/@test/doc-123.json", asset2.Hash)
	if err != nil {
		t.Fatalf("Failed to link asset2: %v", err)
	}

	beforeAssets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}
	if len(beforeAssets) != 2 {
		t.Fatalf("Expected 2 assets before unlink, got %d", len(beforeAssets))
	}

	err = service.UnlinkAllFromDocument("projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("UnlinkAllFromDocument() failed: %v", err)
	}

	afterAssets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}

	if len(afterAssets) != 0 {
		t.Errorf("Expected 0 assets after unlinking all, got %d", len(afterAssets))
	}
}

func TestService_UnlinkAllFromDocument_ValidationErrors(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	tests := []struct {
		name    string
		docPath string
		wantErr bool
	}{
		{
			name:    "empty document path",
			docPath: "",
			wantErr: true,
		},
		{
			name:    "whitespace document path",
			docPath: "   ",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.UnlinkAllFromDocument(tt.docPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("UnlinkAllFromDocument() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestService_UnlinkAllFromDocument_NilStore(t *testing.T) {
	service := NewService(ServiceConfig{
		DB:    nil,
		Store: nil,
		Vault: nil,
	})

	err := service.UnlinkAllFromDocument("projects/@test/doc.json")
	if err == nil {
		t.Error("UnlinkAllFromDocument() should fail with nil store")
	}
}

func TestService_LinkToDocument_PreservesOtherLinks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project')
	`)
	if err != nil {
		t.Fatalf("Failed to setup test project: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("Failed to insert doc-1: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 2000000, 100)
	`, "projects/@test/doc-2.json")
	if err != nil {
		t.Fatalf("Failed to setup test documents: %v", err)
	}

	asset := &Asset{
		Hash:      ComputeHash([]byte("shared asset")),
		Ext:       ".png",
		Bytes:     12,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Failed to create asset: %v", err)
	}

	err = service.LinkToDocument("projects/@test/doc-1.json", asset.Hash)
	if err != nil {
		t.Fatalf("Failed to link to doc-1: %v", err)
	}

	err = service.LinkToDocument("projects/@test/doc-2.json", asset.Hash)
	if err != nil {
		t.Fatalf("Failed to link to doc-2: %v", err)
	}

	doc1Assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() for doc-1 failed: %v", err)
	}
	if len(doc1Assets) != 1 {
		t.Fatalf("Expected 1 asset for doc-1, got %d", len(doc1Assets))
	}

	doc2Assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-2.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() for doc-2 failed: %v", err)
	}
	if len(doc2Assets) != 1 {
		t.Fatalf("Expected 1 asset for doc-2, got %d", len(doc2Assets))
	}

	err = service.UnlinkFromDocument("projects/@test/doc-1.json", asset.Hash)
	if err != nil {
		t.Fatalf("Failed to unlink from doc-1: %v", err)
	}

	doc1AssetsAfter, err := store.GetDocumentAssets(ctx, "projects/@test/doc-1.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() after unlink failed: %v", err)
	}
	if len(doc1AssetsAfter) != 0 {
		t.Errorf("Expected 0 assets for doc-1 after unlink, got %d", len(doc1AssetsAfter))
	}

	doc2AssetsAfter, err := store.GetDocumentAssets(ctx, "projects/@test/doc-2.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() for doc-2 after unlink failed: %v", err)
	}
	if len(doc2AssetsAfter) != 1 {
		t.Errorf("Expected doc-2 to still have 1 asset, got %d", len(doc2AssetsAfter))
	}
}
