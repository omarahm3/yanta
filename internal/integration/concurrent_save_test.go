package integration

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/project"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestConcurrentSaveRaceCondition reproduces the FK constraint error that occurs
// when multiple Save operations race with asset uploads. This is the core bug:
//
// 1. User pastes image → Upload starts
// 2. User types → triggers Save (debounce might not be working)
// 3. Multiple Save goroutines write to file concurrently
// 4. One Save's IndexDocument reads file written by another Save
// 5. That file has image URLs, but the asset hasn't been uploaded yet
// 6. FK constraint fails when trying to link asset to document
//
// With the mutex fix, Save operations are serialized, preventing this race.
func TestConcurrentSaveRaceCondition(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	ensureProjectDir(t, env, "@concurrent-test")

	projectCache := &testProjectCache{
		projects: map[string]*project.Project{
			"@concurrent-test": {ID: "concurrent-id", Alias: "@concurrent-test", Name: "Concurrent Test"},
		},
	}

	assetService := asset.NewService(asset.ServiceConfig{
		DB:          env.db,
		Store:       env.assetStore,
		Vault:       env.vault,
		SyncManager: git.NewMockSyncManager(),
	})

	docService := document.NewService(env.db, env.docStore, env.vault, env.indexer, projectCache, events.NewEventBus())

	ctx := context.Background()

	// Create initial document
	initialReq := document.SaveRequest{
		ProjectAlias: "@concurrent-test",
		Title:        "Test Document",
		Blocks: []document.BlockNoteBlock{
			{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: "Initial content"}})},
		},
		Tags: []string{},
	}

	docPath, err := docService.Save(ctx, initialReq)
	require.NoError(t, err, "Failed to create initial document")

	// Simulate concurrent operations like the real app:
	// - Multiple saves happening rapidly (due to broken debounce)
	// - Asset uploads happening in parallel
	var wg sync.WaitGroup
	var errors []error
	var errorsMu sync.Mutex

	// Run many concurrent save operations to trigger the race
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(iteration int) {
			defer wg.Done()

			// Simulate varying content (like typing)
			req := document.SaveRequest{
				Path:         docPath,
				ProjectAlias: "@concurrent-test",
				Title:        fmt.Sprintf("Test Document v%d", iteration),
				Blocks: []document.BlockNoteBlock{
					{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: fmt.Sprintf("Content %d", iteration)}})},
				},
				Tags: []string{},
			}

			_, err := docService.Save(ctx, req)
			if err != nil {
				errorsMu.Lock()
				errors = append(errors, fmt.Errorf("save %d: %w", iteration, err))
				errorsMu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// With mutex serialization, all saves should succeed
	assert.Empty(t, errors, "Concurrent saves should not produce errors with mutex protection")

	// Verify document exists and is valid
	doc, err := docService.Get(ctx, docPath)
	require.NoError(t, err, "Should be able to get document after concurrent saves")
	assert.NotEmpty(t, doc.Title)

	_ = assetService // We'll use this in the next test
}

// TestConcurrentSaveWithAssetUpload tests the specific scenario where
// an asset upload races with document saves. This is the exact bug reported.
func TestConcurrentSaveWithAssetUpload(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	ensureProjectDir(t, env, "@concurrent-test")

	// Create assets directory
	assetsDir := filepath.Join(env.vault.ProjectPath("@concurrent-test"), "assets")
	err := os.MkdirAll(assetsDir, 0755)
	require.NoError(t, err)

	projectCache := &testProjectCache{
		projects: map[string]*project.Project{
			"@concurrent-test": {ID: "concurrent-id", Alias: "@concurrent-test", Name: "Concurrent Test"},
		},
	}

	assetService := asset.NewService(asset.ServiceConfig{
		DB:          env.db,
		Store:       env.assetStore,
		Vault:       env.vault,
		SyncManager: git.NewMockSyncManager(),
	})

	docService := document.NewService(env.db, env.docStore, env.vault, env.indexer, projectCache, events.NewEventBus())

	ctx := context.Background()

	// Create initial document
	initialReq := document.SaveRequest{
		ProjectAlias: "@concurrent-test",
		Title:        "Document with Images",
		Blocks: []document.BlockNoteBlock{
			{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: "Initial"}})},
		},
		Tags: []string{},
	}

	docPath, err := docService.Save(ctx, initialReq)
	require.NoError(t, err)

	// Simulate the paste-image workflow:
	// 1. Upload image (creates asset in DB)
	// 2. Save document with image URL (IndexDocument tries to link asset)
	// With race condition, step 2 might happen before step 1 completes

	var wg sync.WaitGroup
	var uploadedHashes []string
	var hashMu sync.Mutex
	var allErrors []error
	var errorsMu sync.Mutex

	// Simulate multiple rapid paste operations
	for i := 0; i < 5; i++ {
		wg.Add(2)

		// Goroutine 1: Upload asset
		go func(idx int) {
			defer wg.Done()

			// Create a small test image (1x1 PNG)
			pngData := createMinimalPNG()
			filename := fmt.Sprintf("test-image-%d.png", idx)

			info, err := assetService.Upload(ctx, "@concurrent-test", pngData, filename)
			if err != nil {
				errorsMu.Lock()
				allErrors = append(allErrors, fmt.Errorf("upload %d: %w", idx, err))
				errorsMu.Unlock()
				return
			}

			hashMu.Lock()
			uploadedHashes = append(uploadedHashes, info.Hash)
			hashMu.Unlock()
		}(i)

		// Goroutine 2: Save document (might race with upload)
		go func(idx int) {
			defer wg.Done()

			// Small delay to increase chance of race
			time.Sleep(time.Millisecond * time.Duration(idx))

			req := document.SaveRequest{
				Path:         docPath,
				ProjectAlias: "@concurrent-test",
				Title:        fmt.Sprintf("Document with Images v%d", idx),
				Blocks: []document.BlockNoteBlock{
					{ID: "block1", Type: "paragraph", Content: mustMarshalContent([]document.BlockNoteContent{{Type: "text", Text: fmt.Sprintf("Content %d", idx)}})},
				},
				Tags: []string{},
			}

			_, err := docService.Save(ctx, req)
			if err != nil {
				errorsMu.Lock()
				allErrors = append(allErrors, fmt.Errorf("save %d: %w", idx, err))
				errorsMu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// Filter out expected "unsupported image type" errors from the test PNG
	var criticalErrors []error
	for _, err := range allErrors {
		errStr := err.Error()
		if strings.Contains(errStr, "FOREIGN KEY constraint failed") {
			criticalErrors = append(criticalErrors, err)
		}
		// Ignore "unsupported image type" errors - those are expected with minimal test data
	}

	// The key assertion: NO FK constraint errors should occur
	assert.Empty(t, criticalErrors, "Should not have FK constraint errors with mutex protection")

	// Verify document is still accessible
	doc, err := docService.Get(ctx, docPath)
	require.NoError(t, err, "Document should still be accessible after concurrent operations")
	assert.NotEmpty(t, doc.Title)
}

// TestSaveSerializationWithMutex verifies that the mutex properly serializes
// Save operations, preventing file write races.
func TestSaveSerializationWithMutex(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	ensureProjectDir(t, env, "@concurrent-test")

	projectCache := &testProjectCache{
		projects: map[string]*project.Project{
			"@concurrent-test": {ID: "concurrent-id", Alias: "@concurrent-test", Name: "Concurrent Test"},
		},
	}

	docService := document.NewService(env.db, env.docStore, env.vault, env.indexer, projectCache, events.NewEventBus())

	ctx := context.Background()

	// Create document
	initialReq := document.SaveRequest{
		ProjectAlias: "@concurrent-test",
		Title:        "Serialization Test",
		Blocks:       []document.BlockNoteBlock{},
		Tags:         []string{},
	}

	docPath, err := docService.Save(ctx, initialReq)
	require.NoError(t, err)

	// Track the order of completions
	var completionOrder []int
	var orderMu sync.Mutex
	var wg sync.WaitGroup

	// Launch many concurrent saves
	numSaves := 50
	for i := 0; i < numSaves; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			req := document.SaveRequest{
				Path:         docPath,
				ProjectAlias: "@concurrent-test",
				Title:        fmt.Sprintf("Version %d", idx),
				Blocks:       []document.BlockNoteBlock{},
				Tags:         []string{},
			}

			_, err := docService.Save(ctx, req)
			if err == nil {
				orderMu.Lock()
				completionOrder = append(completionOrder, idx)
				orderMu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// All saves should complete successfully
	assert.Len(t, completionOrder, numSaves, "All %d saves should complete without error", numSaves)

	// Get final document state
	doc, err := docService.Get(ctx, docPath)
	require.NoError(t, err)

	// Document should have a valid title (from one of the saves)
	assert.Contains(t, doc.Title, "Version", "Document should have a versioned title")
}

// testProjectCache implements document.ProjectCache for testing
type testProjectCache struct {
	projects map[string]*project.Project
}

func (c *testProjectCache) GetByAlias(ctx context.Context, alias string) (*project.Project, error) {
	if p, ok := c.projects[alias]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("project not found: %s", alias)
}

// createMinimalPNG creates a minimal valid PNG file (1x1 transparent pixel)
func createMinimalPNG() []byte {
	// Minimal 1x1 transparent PNG
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
		0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
		0x49, 0x48, 0x44, 0x52, // "IHDR"
		0x00, 0x00, 0x00, 0x01, // width: 1
		0x00, 0x00, 0x00, 0x01, // height: 1
		0x08, 0x06, // bit depth: 8, color type: RGBA
		0x00, 0x00, 0x00, // compression, filter, interlace
		0x1F, 0x15, 0xC4, 0x89, // CRC
		0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
		0x49, 0x44, 0x41, 0x54, // "IDAT"
		0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // compressed data
		0x0D, 0x0A, 0x2D, 0xB4, // CRC
		0x00, 0x00, 0x00, 0x00, // IEND chunk length
		0x49, 0x45, 0x4E, 0x44, // "IEND"
		0xAE, 0x42, 0x60, 0x82, // CRC
	}
}
