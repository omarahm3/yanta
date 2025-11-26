package asset

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"yanta/internal/git"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockVaultProvider struct {
	rootPath string
}

func (m *mockVaultProvider) AssetsPath(projectAlias string) string {
	return filepath.Join(m.rootPath, "projects", projectAlias, "assets")
}

func (m *mockVaultProvider) EnsureProjectDir(projectAlias string) error {
	return os.MkdirAll(filepath.Join(m.rootPath, "projects", projectAlias, "assets"), 0755)
}

func newTestVault(t *testing.T) *mockVaultProvider {
	tmpDir, err := os.MkdirTemp("", "upload-handler-test-*")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	projectDir := filepath.Join(tmpDir, "projects", "@test-project", "assets")
	require.NoError(t, os.MkdirAll(projectDir, 0755))

	return &mockVaultProvider{rootPath: tmpDir}
}

func createMultipartRequest(t *testing.T, projectAlias string, filename string, content []byte) *http.Request {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	err := writer.WriteField("project", projectAlias)
	require.NoError(t, err)

	part, err := writer.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)

	err = writer.Close()
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func minimalPNG() []byte {
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
		0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
		0x42, 0x60, 0x82,
	}
}

func TestUploadHandler_Success(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	req := createMultipartRequest(t, "@test-project", "test.png", minimalPNG())
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var response UploadResponse
	err := json.NewDecoder(rec.Body).Decode(&response)
	require.NoError(t, err)

	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Hash)
	assert.Equal(t, ".png", response.Ext)
	assert.NotEmpty(t, response.URL)
	assert.Empty(t, response.Error)
}

func TestUploadHandler_MissingProject(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, _ := writer.CreateFormFile("file", "test.png")
	part.Write(minimalPNG())
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response UploadResponse
	json.NewDecoder(rec.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "project")
}

func TestUploadHandler_MissingFile(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	writer.WriteField("project", "@test-project")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response UploadResponse
	json.NewDecoder(rec.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "file")
}

func TestUploadHandler_EmptyFile(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	req := createMultipartRequest(t, "@test-project", "empty.png", []byte{})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response UploadResponse
	json.NewDecoder(rec.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "empty")
}

func TestUploadHandler_FileTooLarge(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	largeFile := make([]byte, 11*1024*1024)
	copy(largeFile[:8], minimalPNG()[:8])

	req := createMultipartRequest(t, "@test-project", "large.png", largeFile)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response UploadResponse
	json.NewDecoder(rec.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "large")
}

func TestUploadHandler_UnsupportedFileType(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	randomData := []byte("this is not an image file")

	req := createMultipartRequest(t, "@test-project", "test.txt", randomData)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response UploadResponse
	json.NewDecoder(rec.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "unsupported")
}

func TestUploadHandler_MethodNotAllowed(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	req := httptest.NewRequest(http.MethodGet, "/api/upload", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
}

func TestUploadHandler_InvalidContentType(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	req := httptest.NewRequest(http.MethodPost, "/api/upload", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadHandler_LargeValidImage(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	// 5MB image - simulates the scenario that was failing with RPC due to URL length limits
	largeImage := make([]byte, 5*1024*1024)
	copy(largeImage, minimalPNG())

	req := createMultipartRequest(t, "@test-project", "large-valid.png", largeImage)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var response UploadResponse
	err := json.NewDecoder(rec.Body).Decode(&response)
	require.NoError(t, err)

	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Hash)
}

func TestUploadHandler_ConcurrentUploads(t *testing.T) {
	db := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t, db)

	vault := newTestVault(t)
	store := NewStore(db)
	service := NewService(ServiceConfig{
		DB:          db,
		Store:       store,
		Vault:       vault,
		SyncManager: git.NewMockSyncManager(),
	})

	handler := NewUploadHandler(service)

	const numUploads = 10
	results := make(chan bool, numUploads)

	for i := 0; i < numUploads; i++ {
		go func(idx int) {
			uniqueImage := append(minimalPNG(), byte(idx), byte(idx+1), byte(idx+2))
			req := createMultipartRequest(t, "@test-project", fmt.Sprintf("concurrent-%d.png", idx), uniqueImage)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			results <- rec.Code == http.StatusOK
		}(i)
	}

	successCount := 0
	for i := 0; i < numUploads; i++ {
		if <-results {
			successCount++
		}
	}

	assert.Equal(t, numUploads, successCount, "All concurrent uploads should succeed")
}

func readBody(r io.Reader) string {
	b, _ := io.ReadAll(r)
	return string(b)
}
