package project

import (
	"context"
	"testing"
	"time"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupCacheTest creates a test database, store, and cache instance
func setupCacheTest(t *testing.T) (*Cache, *Store, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)
	cache := NewCache(store)

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return cache, store, cleanup
}

func TestNewCache(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	cache := NewCache(store)

	assert.NotNil(t, cache, "Cache should not be nil")
	assert.Equal(t, store, cache.store, "Store should be set correctly")
	assert.NotNil(t, cache.ctx, "Context should be initialized")
	// Note: We can't directly test sync.Map as it contains a mutex
}

func TestCache_SetContext(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.WithValue(context.Background(), "test", "value")
	cache.SetContext(ctx)

	assert.Equal(t, ctx, cache.ctx, "Context should be updated")
}

func TestCache_GetByID(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test project
	project, err := New("Cache Test Project", "cache-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create test project")

	t.Run("get existing project from store", func(t *testing.T) {
		// First call should hit the store
		result, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		require.NotNil(t, result, "GetByID() returned nil project")

		assert.Equal(t, created.ID, result.ID, "Project ID mismatch")
		assert.Equal(t, "Cache Test Project", result.Name, "Project name mismatch")
		assert.Equal(t, "@cache-test", result.Alias, "Project alias mismatch")
	})

	t.Run("get cached project", func(t *testing.T) {
		// Second call should hit the cache
		result, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		require.NotNil(t, result, "GetByID() returned nil project")

		assert.Equal(t, created.ID, result.ID, "Project ID mismatch")
		assert.Equal(t, "Cache Test Project", result.Name, "Project name mismatch")
	})

	t.Run("get non-existent project", func(t *testing.T) {
		_, err := cache.GetByID("non-existent-id")
		assert.Error(t, err, "GetByID() should have failed for non-existent project")
	})

	t.Run("get with empty ID", func(t *testing.T) {
		_, err := cache.GetByID("")
		assert.Error(t, err, "GetByID() should have failed for empty ID")
	})
}

func TestCache_Set(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	t.Run("set valid project", func(t *testing.T) {
		project, err := New("Set Test Project", "set-test", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project.ID = "test-id-1"

		cache.Set(project)

		// Verify it's cached
		cached, ok := cache.cache.Load(project.ID)
		assert.True(t, ok, "Project should be cached")
		assert.Equal(t, project, cached, "Cached project should match original")
	})

	t.Run("set nil project", func(t *testing.T) {
		cache.Set(nil)

		// Should not crash and should not cache anything
		// We can't easily test this without exposing internal state
		// but the function should handle nil gracefully
	})

	t.Run("set project with empty ID", func(t *testing.T) {
		project, err := New("Empty ID Project", "empty-id", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project.ID = "" // Empty ID

		cache.Set(project)

		// Should not cache project with empty ID
		_, ok := cache.cache.Load("")
		assert.False(t, ok, "Project with empty ID should not be cached")
	})

	t.Run("set project with same ID overwrites", func(t *testing.T) {
		project1, err := New("Original Project", "original", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project1.ID = "overwrite-test"

		project2, err := New("Updated Project", "updated", "2024-02-01", "2024-11-30")
		require.NoError(t, err, "Failed to create test project")
		project2.ID = "overwrite-test" // Same ID

		cache.Set(project1)
		cache.Set(project2)

		// Should have the updated project
		cached, ok := cache.cache.Load("overwrite-test")
		assert.True(t, ok, "Project should be cached")
		assert.Equal(t, project2, cached, "Should have the updated project")
	})
}

func TestCache_Invalidate(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	// Set up a project in cache
	project, err := New("Invalidate Test Project", "invalidate-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project")
	project.ID = "invalidate-test-id"

	cache.Set(project)

	// Verify it's cached
	_, ok := cache.cache.Load(project.ID)
	assert.True(t, ok, "Project should be cached before invalidation")

	t.Run("invalidate existing project", func(t *testing.T) {
		cache.Invalidate(project.ID)

		// Verify it's no longer cached
		_, ok := cache.cache.Load(project.ID)
		assert.False(t, ok, "Project should not be cached after invalidation")
	})

	t.Run("invalidate non-existent project", func(t *testing.T) {
		// Should not crash
		cache.Invalidate("non-existent-id")
	})

	t.Run("invalidate empty ID", func(t *testing.T) {
		// Should not crash
		cache.Invalidate("")
	})
}

func TestCache_Clear(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	// Set up multiple projects in cache
	projects := []*Project{}
	for i := 0; i < 5; i++ {
		project, err := New("Clear Test Project "+string(rune('A'+i)), "clear-test-"+string(rune('a'+i)), "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project.ID = "clear-test-id-" + string(rune('0'+i))
		projects = append(projects, project)
		cache.Set(project)
	}

	// Verify all projects are cached
	for _, project := range projects {
		_, ok := cache.cache.Load(project.ID)
		assert.True(t, ok, "Project %s should be cached", project.ID)
	}

	t.Run("clear all cached projects", func(t *testing.T) {
		cache.Clear()

		// Verify all projects are no longer cached
		for _, project := range projects {
			_, ok := cache.cache.Load(project.ID)
			assert.False(t, ok, "Project %s should not be cached after clear", project.ID)
		}
	})

	t.Run("clear empty cache", func(t *testing.T) {
		// Should not crash
		cache.Clear()
	})
}

func TestCache_Get(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test projects
	project1, err := New("Get Test Project 1", "get-test-1", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project 1")

	project2, err := New("Get Test Project 2", "get-test-2", "2024-02-01", "2024-11-30")
	require.NoError(t, err, "Failed to create test project 2")

	created1, err := store.Create(ctx, project1)
	require.NoError(t, err, "Failed to create test project 1")

	created2, err := store.Create(ctx, project2)
	require.NoError(t, err, "Failed to create test project 2")

	t.Run("get all projects from store", func(t *testing.T) {
		ids := []string{created1.ID, created2.ID}
		result, err := cache.Get(ids)
		require.NoError(t, err, "Get() failed")
		require.NotNil(t, result, "Get() returned nil result")

		assert.Len(t, result, 2, "Should return 2 projects")
		assert.Equal(t, created1.ID, result[created1.ID].ID, "Project 1 ID mismatch")
		assert.Equal(t, created2.ID, result[created2.ID].ID, "Project 2 ID mismatch")
		assert.Equal(t, "Get Test Project 1", result[created1.ID].Name, "Project 1 name mismatch")
		assert.Equal(t, "Get Test Project 2", result[created2.ID].Name, "Project 2 name mismatch")
	})

	t.Run("get mixed cached and non-cached projects", func(t *testing.T) {
		// First call should cache both projects
		ids := []string{created1.ID, created2.ID}
		result, err := cache.Get(ids)
		require.NoError(t, err, "Get() failed")
		assert.Len(t, result, 2, "Should return 2 projects")

		// Second call should use cache for both
		result2, err := cache.Get(ids)
		require.NoError(t, err, "Get() failed")
		assert.Len(t, result2, 2, "Should return 2 projects")

		// Results should be identical
		assert.Equal(t, result[created1.ID].ID, result2[created1.ID].ID, "Cached project 1 should match")
		assert.Equal(t, result[created2.ID].ID, result2[created2.ID].ID, "Cached project 2 should match")
	})

	t.Run("get non-existent projects", func(t *testing.T) {
		ids := []string{"non-existent-1", "non-existent-2"}
		_, err := cache.Get(ids)
		assert.Error(t, err, "Get() should have failed for non-existent projects")
	})

	t.Run("get empty slice", func(t *testing.T) {
		result, err := cache.Get([]string{})
		require.NoError(t, err, "Get() with empty slice should not fail")
		assert.Len(t, result, 0, "Should return empty result for empty slice")
	})

	t.Run("get with duplicate IDs", func(t *testing.T) {
		ids := []string{created1.ID, created1.ID, created2.ID}
		result, err := cache.Get(ids)
		require.NoError(t, err, "Get() failed")
		assert.Len(t, result, 2, "Should return 2 unique projects")
		assert.Contains(t, result, created1.ID, "Should contain project 1")
		assert.Contains(t, result, created2.ID, "Should contain project 2")
	})
}

func TestCache_WarmUp(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test projects
	project1, err := New("WarmUp Test Project 1", "warmup-test-1", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project 1")

	project2, err := New("WarmUp Test Project 2", "warmup-test-2", "2024-02-01", "2024-11-30")
	require.NoError(t, err, "Failed to create test project 2")

	created1, err := store.Create(ctx, project1)
	require.NoError(t, err, "Failed to create test project 1")

	created2, err := store.Create(ctx, project2)
	require.NoError(t, err, "Failed to create test project 2")

	t.Run("warm up existing projects", func(t *testing.T) {
		ids := []string{created1.ID, created2.ID}
		err := cache.WarmUp(ids)
		require.NoError(t, err, "WarmUp() failed")

		// Verify projects are cached
		_, ok1 := cache.cache.Load(created1.ID)
		_, ok2 := cache.cache.Load(created2.ID)
		assert.True(t, ok1, "Project 1 should be cached after warm up")
		assert.True(t, ok2, "Project 2 should be cached after warm up")
	})

	t.Run("warm up non-existent projects", func(t *testing.T) {
		ids := []string{"non-existent-1", "non-existent-2"}
		err := cache.WarmUp(ids)
		assert.Error(t, err, "WarmUp() should have failed for non-existent projects")
		assert.Contains(t, err.Error(), "warming up project cache", "Error should mention cache warming")
	})

	t.Run("warm up mixed existing and non-existent projects", func(t *testing.T) {
		ids := []string{created1.ID, "non-existent-id"}
		err := cache.WarmUp(ids)
		assert.Error(t, err, "WarmUp() should have failed for mixed IDs")
	})

	t.Run("warm up empty slice", func(t *testing.T) {
		err := cache.WarmUp([]string{})
		require.NoError(t, err, "WarmUp() with empty slice should not fail")
	})
}

func TestCache_Integration(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project
	project, err := New("Integration Test Project", "integration-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create test project")

	t.Run("cache miss then hit", func(t *testing.T) {
		// First call - cache miss
		result1, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		assert.Equal(t, created.ID, result1.ID, "Project ID mismatch")

		// Second call - cache hit
		result2, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		assert.Equal(t, result1.ID, result2.ID, "Cached project should match")
		assert.Equal(t, result1.Name, result2.Name, "Cached project name should match")
	})

	t.Run("cache invalidation", func(t *testing.T) {
		// Get project (should cache it)
		_, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")

		// Invalidate cache
		cache.Invalidate(created.ID)

		// Get project again (should hit store again)
		result, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		assert.Equal(t, created.ID, result.ID, "Project ID mismatch")
	})

	t.Run("cache update after store update", func(t *testing.T) {
		// Get project (should cache it)
		_, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")

		// Update project in store
		updatedProject, err := New("Updated Integration Project", "updated-integration", "2024-02-01", "2024-11-30")
		require.NoError(t, err, "Failed to create updated project")
		updatedProject.ID = created.ID

		_, err = store.Update(ctx, updatedProject)
		require.NoError(t, err, "Failed to update project in store")

		// Cache should still have old data
		cached, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		assert.Equal(t, "Integration Test Project", cached.Name, "Cache should have old data")

		// Invalidate cache
		cache.Invalidate(created.ID)

		// Now should get updated data
		updated, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID() failed")
		assert.Equal(t, "Updated Integration Project", updated.Name, "Should get updated data after invalidation")
	})
}

func TestCache_ConcurrentAccess(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test projects
	const numProjects = 10
	projects := make([]*Project, numProjects)
	created := make([]*Project, numProjects)

	for i := 0; i < numProjects; i++ {
		project, err := New("Concurrent Project "+string(rune('A'+i)), "concurrent-"+string(rune('a'+i)), "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project %d", i)
		projects[i] = project

		created[i], err = store.Create(ctx, project)
		require.NoError(t, err, "Failed to create test project %d", i)
	}

	t.Run("concurrent GetByID", func(t *testing.T) {
		const numGoroutines = 20
		results := make(chan *Project, numGoroutines)
		errors := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				projectID := created[i%numProjects].ID
				result, err := cache.GetByID(projectID)
				if err != nil {
					errors <- err
					return
				}
				results <- result
			}(i)
		}

		// Collect results
		var retrievedProjects []*Project
		for i := 0; i < numGoroutines; i++ {
			select {
			case project := <-results:
				retrievedProjects = append(retrievedProjects, project)
			case err := <-errors:
				t.Errorf("Concurrent GetByID failed: %v", err)
			}
		}

		assert.Len(t, retrievedProjects, numGoroutines, "Expected %d concurrent GetByID results", numGoroutines)
	})

	t.Run("concurrent Set and GetByID", func(t *testing.T) {
		const numGoroutines = 20
		done := make(chan bool, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				defer func() { done <- true }()

				projectID := created[i%numProjects].ID

				// Mix of Set and GetByID operations
				if i%2 == 0 {
					// GetByID operation
					_, err := cache.GetByID(projectID)
					if err != nil {
						t.Errorf("Concurrent GetByID failed: %v", err)
					}
				} else {
					// Set operation
					project := created[i%numProjects]
					cache.Set(project)
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			<-done
		}

		// Verify cache is in consistent state
		for i := 0; i < numProjects; i++ {
			result, err := cache.GetByID(created[i].ID)
			require.NoError(t, err, "GetByID failed for project %d", i)
			assert.Equal(t, created[i].ID, result.ID, "Project %d ID mismatch", i)
		}
	})

	t.Run("concurrent Invalidate and GetByID", func(t *testing.T) {
		const numGoroutines = 20
		done := make(chan bool, numGoroutines)

		// Pre-populate cache
		for i := 0; i < numProjects; i++ {
			_, err := cache.GetByID(created[i].ID)
			require.NoError(t, err, "Failed to pre-populate cache")
		}

		for i := 0; i < numGoroutines; i++ {
			go func(i int) {
				defer func() { done <- true }()

				projectID := created[i%numProjects].ID

				// Mix of Invalidate and GetByID operations
				if i%2 == 0 {
					// Invalidate operation
					cache.Invalidate(projectID)
				} else {
					// GetByID operation
					_, err := cache.GetByID(projectID)
					if err != nil {
						t.Errorf("Concurrent GetByID failed: %v", err)
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numGoroutines; i++ {
			<-done
		}

		// Verify cache is in consistent state
		for i := 0; i < numProjects; i++ {
			result, err := cache.GetByID(created[i].ID)
			require.NoError(t, err, "GetByID failed for project %d", i)
			assert.Equal(t, created[i].ID, result.ID, "Project %d ID mismatch", i)
		}
	})
}

func TestCache_EdgeCases(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	t.Run("get with context cancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately
		cache.SetContext(ctx)

		_, err := cache.GetByID("some-id")
		assert.Error(t, err, "GetByID with cancelled context should fail")
	})

	t.Run("get with timeout context", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
		defer cancel()
		cache.SetContext(ctx)
		time.Sleep(1 * time.Millisecond) // Ensure timeout

		_, err := cache.GetByID("some-id")
		assert.Error(t, err, "GetByID with timeout context should fail")
	})

	t.Run("set project with special characters in ID", func(t *testing.T) {
		project, err := New("Special ID Project", "special-id", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project.ID = "special-id-with-chars:!@#$%^&*()"

		cache.Set(project)

		// Verify it's cached
		cached, ok := cache.cache.Load(project.ID)
		assert.True(t, ok, "Project with special characters in ID should be cached")
		assert.Equal(t, project, cached, "Cached project should match original")
	})

	t.Run("set project with unicode characters in ID", func(t *testing.T) {
		project, err := New("Unicode ID Project", "unicode-id", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create test project")
		project.ID = "unicode-id-项目-🚀-ñ"

		cache.Set(project)

		// Verify it's cached
		cached, ok := cache.cache.Load(project.ID)
		assert.True(t, ok, "Project with unicode characters in ID should be cached")
		assert.Equal(t, project, cached, "Cached project should match original")
	})

	t.Run("get with very long ID", func(t *testing.T) {
		longID := string(make([]byte, 1000))
		for i := range longID {
			longID = longID[:i] + "a" + longID[i+1:]
		}

		_, err := cache.GetByID(longID)
		assert.Error(t, err, "GetByID with very long ID should fail")
	})

	t.Run("warm up with duplicate IDs", func(t *testing.T) {
		// This should not cause issues
		ids := []string{"id1", "id1", "id2", "id2"}
		err := cache.WarmUp(ids)
		assert.Error(t, err, "WarmUp with non-existent duplicate IDs should fail")
	})
}

func TestCache_ErrorHandling(t *testing.T) {
	cache, _, cleanup := setupCacheTest(t)
	defer cleanup()

	t.Run("get with non-existent project", func(t *testing.T) {
		_, err := cache.GetByID("non-existent-id")
		assert.Error(t, err, "GetByID with non-existent ID should fail")
	})

	t.Run("get multiple with non-existent projects", func(t *testing.T) {
		_, err := cache.Get([]string{"non-existent-1", "non-existent-2"})
		assert.Error(t, err, "Get with non-existent IDs should fail")
	})

	t.Run("warm up with non-existent projects", func(t *testing.T) {
		err := cache.WarmUp([]string{"non-existent-1", "non-existent-2"})
		assert.Error(t, err, "WarmUp with non-existent IDs should fail")
		assert.Contains(t, err.Error(), "warming up project cache", "Error should mention cache warming")
	})

	t.Run("get with context cancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately
		cache.SetContext(ctx)

		_, err := cache.GetByID("some-id")
		assert.Error(t, err, "GetByID with cancelled context should fail")
	})

	t.Run("get with timeout context", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
		defer cancel()
		cache.SetContext(ctx)
		time.Sleep(1 * time.Millisecond) // Ensure timeout

		_, err := cache.GetByID("some-id")
		assert.Error(t, err, "GetByID with timeout context should fail")
	})
}

func TestCache_Performance(t *testing.T) {
	cache, store, cleanup := setupCacheTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test project
	project, err := New("Performance Test Project", "perf-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create test project")

	t.Run("cache hit performance", func(t *testing.T) {
		// First call to populate cache
		_, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID failed")

		// Measure cache hit performance
		start := time.Now()
		const iterations = 1000

		for i := 0; i < iterations; i++ {
			_, err := cache.GetByID(created.ID)
			require.NoError(t, err, "GetByID failed")
		}

		elapsed := time.Since(start)
		avgTime := elapsed / iterations

		// Cache hits should be very fast (less than 1ms per operation)
		assert.Less(t, avgTime, 1*time.Millisecond, "Cache hit should be fast, got %v average", avgTime)
	})

	t.Run("cache miss vs hit comparison", func(t *testing.T) {
		// Clear cache
		cache.Clear()

		// Measure cache miss
		start := time.Now()
		_, err := cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID failed")
		missTime := time.Since(start)

		// Measure cache hit
		start = time.Now()
		_, err = cache.GetByID(created.ID)
		require.NoError(t, err, "GetByID failed")
		hitTime := time.Since(start)

		// Cache hit should be significantly faster than cache miss
		assert.Less(t, hitTime, missTime, "Cache hit (%v) should be faster than cache miss (%v)", hitTime, missTime)
	})
}
