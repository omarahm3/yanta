package asset

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
	"yanta/internal/testutil"
)

type mockVault struct {
	rootPath string
}

const testProjectAlias = "@test-project"

func (m *mockVault) AssetsPath(projectAlias string) string {
	return filepath.Join(m.rootPath, "projects", projectAlias, "assets")
}

func (m *mockVault) EnsureProjectDir(projectAlias string) error {
	assetsPath := m.AssetsPath(projectAlias)
	return os.MkdirAll(assetsPath, 0755)
}

func TestComputeHash(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want string
	}{
		{
			name: "empty data",
			data: []byte{},
			want: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			name: "hello world",
			data: []byte("hello world"),
			want: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeHash(tt.data)
			if got != tt.want {
				t.Errorf("ComputeHash() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestValidateHash(t *testing.T) {
	tests := []struct {
		name    string
		hash    string
		wantErr bool
	}{
		{
			name:    "valid hash",
			hash:    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			wantErr: false,
		},
		{
			name:    "too short",
			hash:    "abc123",
			wantErr: true,
		},
		{
			name:    "too long",
			hash:    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
			wantErr: true,
		},
		{
			name:    "invalid characters",
			hash:    "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg",
			wantErr: true,
		},
		{
			name:    "uppercase not allowed",
			hash:    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateHash(tt.hash)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateHash() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateExtension(t *testing.T) {
	tests := []struct {
		name    string
		ext     string
		wantErr bool
	}{
		{
			name:    "valid png",
			ext:     ".png",
			wantErr: false,
		},
		{
			name:    "valid pdf",
			ext:     ".pdf",
			wantErr: false,
		},
		{
			name:    "empty is valid",
			ext:     "",
			wantErr: false,
		},
		{
			name:    "missing dot",
			ext:     "png",
			wantErr: true,
		},
		{
			name:    "too long",
			ext:     ".verylongext",
			wantErr: true,
		},
		{
			name:    "invalid character",
			ext:     ".p$g",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateExtension(tt.ext)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateExtension() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeExtension(t *testing.T) {
	tests := []struct {
		name string
		ext  string
		want string
	}{
		{
			name: "already normalized",
			ext:  ".png",
			want: ".png",
		},
		{
			name: "uppercase",
			ext:  ".PNG",
			want: ".png",
		},
		{
			name: "missing dot",
			ext:  "png",
			want: ".png",
		},
		{
			name: "empty",
			ext:  "",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeExtension(tt.ext)
			if got != tt.want {
				t.Errorf("NormalizeExtension() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDetectMIME(t *testing.T) {
	tests := []struct {
		name string
		ext  string
		want string
	}{
		{
			name: "png",
			ext:  ".png",
			want: "image/png",
		},
		{
			name: "jpeg",
			ext:  ".jpg",
			want: "image/jpeg",
		},
		{
			name: "pdf",
			ext:  ".pdf",
			want: "application/pdf",
		},
		{
			name: "unknown",
			ext:  ".xyz",
			want: "application/octet-stream",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectMIME(tt.ext)
			if got != tt.want {
				t.Errorf("DetectMIME() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAsset_Validate(t *testing.T) {
	validHash := ComputeHash([]byte("test"))
	now := time.Now()

	tests := []struct {
		name    string
		asset   *Asset
		wantErr bool
	}{
		{
			name: "valid asset",
			asset: &Asset{
				Hash:      validHash,
				Ext:       ".png",
				Bytes:     100,
				MIME:      "image/png",
				CreatedAt: now,
			},
			wantErr: false,
		},
		{
			name: "invalid hash",
			asset: &Asset{
				Hash:      "invalid",
				Ext:       ".png",
				Bytes:     100,
				MIME:      "image/png",
				CreatedAt: now,
			},
			wantErr: true,
		},
		{
			name: "invalid extension",
			asset: &Asset{
				Hash:      validHash,
				Ext:       "png",
				Bytes:     100,
				MIME:      "image/png",
				CreatedAt: now,
			},
			wantErr: true,
		},
		{
			name: "zero bytes",
			asset: &Asset{
				Hash:      validHash,
				Ext:       ".png",
				Bytes:     0,
				MIME:      "image/png",
				CreatedAt: now,
			},
			wantErr: true,
		},
		{
			name: "empty MIME",
			asset: &Asset{
				Hash:      validHash,
				Ext:       ".png",
				Bytes:     100,
				MIME:      "",
				CreatedAt: now,
			},
			wantErr: true,
		},
		{
			name: "zero created_at",
			asset: &Asset{
				Hash:  validHash,
				Ext:   ".png",
				Bytes: 100,
				MIME:  "image/png",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.asset.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Asset.Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestStore_Upsert(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	asset := &Asset{
		Hash:      ComputeHash([]byte("test data")),
		Ext:       ".png",
		Bytes:     9,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}

	exists, err := store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Upsert() failed: %v", err)
	}
	if exists {
		t.Error("First insert should return exists=false")
	}

	exists, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Upsert() failed on second call: %v", err)
	}
	if !exists {
		t.Error("Second insert should return exists=true")
	}

	retrieved, err := store.GetByHash(ctx, asset.Hash)
	if err != nil {
		t.Fatalf("GetByHash() failed: %v", err)
	}

	if retrieved.Hash != asset.Hash {
		t.Errorf("Hash mismatch: got %s, want %s", retrieved.Hash, asset.Hash)
	}
	if retrieved.Ext != asset.Ext {
		t.Errorf("Ext mismatch: got %s, want %s", retrieved.Ext, asset.Ext)
	}
}

func TestStore_GetByHash(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	asset := &Asset{
		Hash:      ComputeHash([]byte("test")),
		Ext:       ".png",
		Bytes:     4,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}

	_, err := store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Upsert() failed: %v", err)
	}

	retrieved, err := store.GetByHash(ctx, asset.Hash)
	if err != nil {
		t.Fatalf("GetByHash() failed: %v", err)
	}

	if retrieved.Hash != asset.Hash {
		t.Errorf("Hash mismatch")
	}

	_, err = store.GetByHash(ctx, "0000000000000000000000000000000000000000000000000000000000000000")
	if err == nil {
		t.Error("GetByHash() should fail for non-existent hash")
	}
}

func TestStore_Delete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	asset := &Asset{
		Hash:      ComputeHash([]byte("test")),
		Ext:       ".png",
		Bytes:     4,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}

	_, err := store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Upsert() failed: %v", err)
	}

	err = store.Delete(ctx, asset.Hash)
	if err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}

	_, err = store.GetByHash(ctx, asset.Hash)
	if err == nil {
		t.Error("GetByHash() should fail after deletion")
	}

	err = store.Delete(ctx, asset.Hash)
	if err == nil {
		t.Error("Delete() should fail for non-existent asset")
	}
}

func TestStore_LinkToDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to insert test document: %v", err)
	}

	asset := &Asset{
		Hash:      ComputeHash([]byte("test")),
		Ext:       ".png",
		Bytes:     4,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Failed to insert asset: %v", err)
	}

	err = store.LinkToDocument(ctx, asset.Hash, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("LinkToDocument() failed: %v", err)
	}

	assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}

	if len(assets) != 1 {
		t.Fatalf("Expected 1 asset, got %d", len(assets))
	}

	if assets[0].Hash != asset.Hash {
		t.Errorf("Hash mismatch: got %s, want %s", assets[0].Hash, asset.Hash)
	}
}

func TestStore_UnlinkFromDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to insert test document: %v", err)
	}

	asset := &Asset{
		Hash:      ComputeHash([]byte("test")),
		Ext:       ".png",
		Bytes:     4,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, asset)
	if err != nil {
		t.Fatalf("Failed to insert asset: %v", err)
	}

	err = store.LinkToDocument(ctx, asset.Hash, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("LinkToDocument() failed: %v", err)
	}

	err = store.UnlinkFromDocument(ctx, asset.Hash, "projects/@test/doc-123.json")
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

	err = store.UnlinkFromDocument(ctx, asset.Hash, "projects/@test/doc-123.json")
	if err == nil {
		t.Error("UnlinkFromDocument() should fail when link doesn't exist")
	}
}

func TestStore_GetOrphanedAssets(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to insert test document: %v", err)
	}

	linkedAsset := &Asset{
		Hash:      ComputeHash([]byte("linked")),
		Ext:       ".png",
		Bytes:     6,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, linkedAsset)
	if err != nil {
		t.Fatalf("Failed to insert linked asset: %v", err)
	}
	err = store.LinkToDocument(ctx, linkedAsset.Hash, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to link asset: %v", err)
	}

	orphanedAsset := &Asset{
		Hash:      ComputeHash([]byte("orphaned")),
		Ext:       ".pdf",
		Bytes:     8,
		MIME:      "application/pdf",
		CreatedAt: time.Now(),
	}
	_, err = store.Upsert(ctx, orphanedAsset)
	if err != nil {
		t.Fatalf("Failed to insert orphaned asset: %v", err)
	}

	orphans, err := store.GetOrphanedAssets(ctx)
	if err != nil {
		t.Fatalf("GetOrphanedAssets() failed: %v", err)
	}

	if len(orphans) != 1 {
		t.Fatalf("Expected 1 orphaned asset, got %d", len(orphans))
	}

	if orphans[0].Hash != orphanedAsset.Hash {
		t.Errorf("Hash mismatch: got %s, want %s", orphans[0].Hash, orphanedAsset.Hash)
	}
}

func TestStore_UnlinkAllFromDocument(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	_, err := db.Exec(`
		INSERT OR IGNORE INTO project (id, alias, name) VALUES ('test-id', '@test-project', 'Test Project');
		INSERT INTO doc (path, project_alias, mtime_ns, size_bytes) VALUES (?, '@test-project', 1000000, 100)
	`, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to insert test document: %v", err)
	}

	asset1 := &Asset{
		Hash:      ComputeHash([]byte("test1")),
		Ext:       ".png",
		Bytes:     5,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}
	asset2 := &Asset{
		Hash:      ComputeHash([]byte("test2")),
		Ext:       ".jpg",
		Bytes:     5,
		MIME:      "image/jpeg",
		CreatedAt: time.Now(),
	}

	_, err = store.Upsert(ctx, asset1)
	if err != nil {
		t.Fatalf("Failed to insert asset1: %v", err)
	}
	_, err = store.Upsert(ctx, asset2)
	if err != nil {
		t.Fatalf("Failed to insert asset2: %v", err)
	}

	err = store.LinkToDocument(ctx, asset1.Hash, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to link asset1: %v", err)
	}
	err = store.LinkToDocument(ctx, asset2.Hash, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("Failed to link asset2: %v", err)
	}

	err = store.UnlinkAllFromDocument(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("UnlinkAllFromDocument() failed: %v", err)
	}

	assets, err := store.GetDocumentAssets(ctx, "projects/@test/doc-123.json")
	if err != nil {
		t.Fatalf("GetDocumentAssets() failed: %v", err)
	}

	if len(assets) != 0 {
		t.Errorf("Expected 0 assets after unlinking all, got %d", len(assets))
	}
}

func TestWriteAsset(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	data := []byte("test image data")
	projectAlias := testProjectAlias
	ext := ".png"

	info, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() failed: %v", err)
	}

	if info.Hash != ComputeHash(data) {
		t.Errorf("Hash mismatch")
	}

	if info.Ext != ext {
		t.Errorf("Extension mismatch: got %s, want %s", info.Ext, ext)
	}

	if info.Bytes != int64(len(data)) {
		t.Errorf("Bytes mismatch: got %d, want %d", info.Bytes, len(data))
	}

	if info.MIME != "image/png" {
		t.Errorf("MIME mismatch: got %s, want image/png", info.MIME)
	}

	if info.AlreadyExist {
		t.Error("First write should have AlreadyExist=false")
	}

	expectedPath := filepath.Join(vault.AssetsPath(projectAlias), info.Hash+ext)
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Error("Asset file was not created")
	}

	info2, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() second call failed: %v", err)
	}

	if !info2.AlreadyExist {
		t.Error("Second write should have AlreadyExist=true")
	}
}

func TestReadAsset(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	data := []byte("test content")
	projectAlias := testProjectAlias
	ext := ".txt"

	info, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() failed: %v", err)
	}

	readData, err := ReadAsset(vault, projectAlias, info.Hash, ext)
	if err != nil {
		t.Fatalf("ReadAsset() failed: %v", err)
	}

	if string(readData) != string(data) {
		t.Errorf("Data mismatch: got %s, want %s", readData, data)
	}
}

func TestReadAsset_HashMismatch(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	data := []byte("original data")
	projectAlias := testProjectAlias
	ext := ".txt"

	info, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() failed: %v", err)
	}

	filePath := filepath.Join(vault.AssetsPath(projectAlias), info.Hash+ext)
	err = os.WriteFile(filePath, []byte("corrupted data"), 0644)
	if err != nil {
		t.Fatalf("Failed to corrupt file: %v", err)
	}

	_, err = ReadAsset(vault, projectAlias, info.Hash, ext)
	if err == nil {
		t.Error("ReadAsset() should fail when hash doesn't match")
	}
}

func TestDeleteAsset(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	data := []byte("to be deleted")
	projectAlias := testProjectAlias
	ext := ".tmp"

	info, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() failed: %v", err)
	}

	exists, err := AssetExists(vault, projectAlias, info.Hash, ext)
	if err != nil {
		t.Fatalf("AssetExists() failed: %v", err)
	}
	if !exists {
		t.Fatal("Asset should exist before deletion")
	}

	err = DeleteAsset(vault, projectAlias, info.Hash, ext)
	if err != nil {
		t.Fatalf("DeleteAsset() failed: %v", err)
	}

	exists, err = AssetExists(vault, projectAlias, info.Hash, ext)
	if err != nil {
		t.Fatalf("AssetExists() failed: %v", err)
	}
	if exists {
		t.Error("Asset should not exist after deletion")
	}
}

func TestAssetExists(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	data := []byte("test")
	projectAlias := testProjectAlias
	ext := ".txt"

	info, err := WriteAsset(vault, projectAlias, data, ext)
	if err != nil {
		t.Fatalf("WriteAsset() failed: %v", err)
	}

	exists, err := AssetExists(vault, projectAlias, info.Hash, ext)
	if err != nil {
		t.Fatalf("AssetExists() failed: %v", err)
	}
	if !exists {
		t.Error("AssetExists() should return true for existing asset")
	}

	exists, err = AssetExists(vault, projectAlias, "0000000000000000000000000000000000000000000000000000000000000000", ext)
	if err != nil {
		t.Fatalf("AssetExists() failed: %v", err)
	}
	if exists {
		t.Error("AssetExists() should return false for non-existent asset")
	}
}

func TestWriteAsset_EmptyData(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	_, err := WriteAsset(vault, testProjectAlias, []byte{}, ".png")
	if err == nil {
		t.Error("WriteAsset() should fail with empty data")
	}
}

func TestWriteAsset_InvalidExtension(t *testing.T) {
	tempDir := t.TempDir()
	vault := &mockVault{rootPath: tempDir}

	_, err := WriteAsset(vault, testProjectAlias, []byte("data"), ".invalid$ext")
	if err == nil {
		t.Error("WriteAsset() should fail with invalid extension")
	}
}

func TestStore_Tx_Operations(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	store := NewStore(db)
	ctx := context.Background()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}
	defer tx.Rollback()

	asset := &Asset{
		Hash:      ComputeHash([]byte("tx test")),
		Ext:       ".png",
		Bytes:     7,
		MIME:      "image/png",
		CreatedAt: time.Now(),
	}

	exists, err := store.UpsertTx(ctx, tx, asset)
	if err != nil {
		t.Fatalf("UpsertTx() failed: %v", err)
	}
	if exists {
		t.Error("First insert should return exists=false")
	}

	retrieved, err := store.GetByHashTx(ctx, tx, asset.Hash)
	if err != nil {
		t.Fatalf("GetByHashTx() failed: %v", err)
	}
	if retrieved.Hash != asset.Hash {
		t.Errorf("Hash mismatch")
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	retrieved, err = store.GetByHash(ctx, asset.Hash)
	if err != nil {
		t.Fatalf("GetByHash() after commit failed: %v", err)
	}
	if retrieved.Hash != asset.Hash {
		t.Errorf("Hash mismatch after commit")
	}
}
