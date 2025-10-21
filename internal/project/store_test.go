package project

import (
	"context"
	"testing"
	"time"
	"yanta/internal/testutil"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupStoreTest creates a test database and store instance
func setupStoreTest(t *testing.T) (*Store, func()) {
	database := testutil.SetupTestDB(t)
	store := NewStore(database)

	cleanup := func() {
		testutil.CleanupTestDB(t, database)
	}

	return store, cleanup
}

func TestStore_Create(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	tests := []struct {
		name        string
		project     *Project
		wantError   bool
		description string
	}{
		{
			name: "create project with all fields",
			project: func() *Project {
				p, _ := New("Test Project", "test-project", "2024-01-01", "2024-12-31")
				return p
			}(),
			wantError:   false,
			description: "Should create project with all fields provided",
		},
		{
			name: "create project with minimal fields",
			project: func() *Project {
				p, _ := New("Minimal Project", "", "", "")
				return p
			}(),
			wantError:   false,
			description: "Should create project with only name, auto-generate ID and use current timestamp",
		},
		{
			name:        "create project with nil project",
			project:     nil,
			wantError:   true,
			description: "Should error when project is nil",
		},
		{
			name: "create project with empty name",
			project: func() *Project {
				p, _ := New("", "empty-name", "2024-01-01", "2024-12-31")
				return p
			}(),
			wantError:   true, // New() validates name and returns error for empty name
			description: "Should error when creating project with empty name (validation is in New())",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := store.Create(ctx, tt.project)

			if tt.wantError {
				assert.Error(t, err, "Create() expected error but got none")
				return
			}

			require.NoError(t, err, "Create() unexpected error: %v", err)
			require.NotNil(t, result, "Create() returned nil project")
			require.NotEmpty(t, result.ID, "Create() returned empty ID")

			// Verify the project was created correctly
			retrieved, err := store.GetByID(ctx, result.ID)
			require.NoError(t, err, "GetByID() failed to retrieve created project")

			assert.Equal(t, tt.project.Name, retrieved.Name, "Project name mismatch")
			assert.Equal(t, tt.project.Alias, retrieved.Alias, "Project alias mismatch")
			assert.Equal(t, tt.project.StartDate, retrieved.StartDate, "Project start_date mismatch")
			assert.Equal(t, tt.project.EndDate, retrieved.EndDate, "Project end_date mismatch")

			// Verify timestamps are set
			assert.NotEmpty(t, retrieved.CreatedAt, "CreatedAt should not be empty")
			assert.NotEmpty(t, retrieved.UpdatedAt, "UpdatedAt should not be empty")
		})
	}
}

func TestStore_CreateTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create project within transaction", func(t *testing.T) {
		// Get the underlying database connection
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		project, err := New("Transaction Project", "tx-project", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create project")

		result, err := store.CreateTx(ctx, tx, project)
		require.NoError(t, err, "CreateTx() failed")
		require.NotNil(t, result, "CreateTx() returned nil project")
		require.NotEmpty(t, result.ID, "CreateTx() returned empty ID")

		// Commit transaction
		err = tx.Commit()
		require.NoError(t, err, "Failed to commit transaction")

		// Verify project exists after commit
		retrieved, err := store.GetByID(ctx, result.ID)
		require.NoError(t, err, "GetByID() failed to retrieve project after transaction commit")
		assert.Equal(t, "Transaction Project", retrieved.Name)
	})

	t.Run("rollback transaction", func(t *testing.T) {
		db := store.db

		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err, "Failed to begin transaction")
		defer tx.Rollback()

		project, err := New("Rollback Project", "rollback-project", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create project")

		result, err := store.CreateTx(ctx, tx, project)
		require.NoError(t, err, "CreateTx() failed")
		require.NotEmpty(t, result.ID, "CreateTx() returned empty ID")

		// Rollback transaction
		err = tx.Rollback()
		require.NoError(t, err, "Failed to rollback transaction")

		// Verify project does not exist after rollback
		_, err = store.GetByID(ctx, result.ID)
		assert.Error(t, err, "GetByID() should have failed after transaction rollback")
	})
}

func TestStore_GetByID(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test project first
	project, err := New("Get Test Project", "get-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create test project")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create test project")

	tests := []struct {
		name        string
		projectID   string
		wantError   bool
		description string
	}{
		{
			name:        "get existing project",
			projectID:   created.ID,
			wantError:   false,
			description: "Should retrieve existing project",
		},
		{
			name:        "get non-existent project",
			projectID:   "non-existent-id",
			wantError:   true,
			description: "Should error when getting non-existent project",
		},
		{
			name:        "get soft deleted project",
			projectID:   created.ID,
			wantError:   true,
			description: "Should error when getting soft deleted project",
		},
	}

	// Test getting existing project
	t.Run(tests[0].name, func(t *testing.T) {
		result, err := store.GetByID(ctx, tests[0].projectID)

		if tests[0].wantError {
			assert.Error(t, err, "GetByID() expected error but got none")
			return
		}

		require.NoError(t, err, "GetByID() unexpected error: %v", err)
		require.NotNil(t, result, "GetByID() returned nil project")

		assert.Equal(t, created.ID, result.ID, "Project ID mismatch")
		assert.Equal(t, "Get Test Project", result.Name, "Project name mismatch")
		assert.Equal(t, "@get-test", result.Alias, "Project alias mismatch")
		assert.Equal(t, "2024-01-01", result.StartDate, "Project start_date mismatch")
		assert.Equal(t, "2024-12-31", result.EndDate, "Project end_date mismatch")
		assert.NotEmpty(t, result.CreatedAt, "CreatedAt should not be empty")
		assert.NotEmpty(t, result.UpdatedAt, "UpdatedAt should not be empty")
	})

	// Test getting non-existent project
	t.Run(tests[1].name, func(t *testing.T) {
		_, err := store.GetByID(ctx, tests[1].projectID)

		if !tests[1].wantError {
			assert.NoError(t, err, "GetByID() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByID() expected error but got none")
	})

	// Soft delete the project and test getting it
	err = store.SoftDelete(ctx, created.ID)
	require.NoError(t, err, "Failed to soft delete project")

	t.Run(tests[2].name, func(t *testing.T) {
		_, err := store.GetByID(ctx, tests[2].projectID)

		if !tests[2].wantError {
			assert.NoError(t, err, "GetByID() unexpected error: %v", err)
			return
		}

		assert.Error(t, err, "GetByID() expected error but got none")
	})
}

func TestStore_Get(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create test projects
	project1, err := New("Project Alpha", "alpha", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project 1")

	project2, err := New("Project Beta", "beta", "2024-02-01", "")
	require.NoError(t, err, "Failed to create project 2")

	project3, err := New("Project Gamma", "gamma", "2024-03-01", "2024-11-30")
	require.NoError(t, err, "Failed to create project 3")

	_, err = store.Create(ctx, project1)
	require.NoError(t, err, "Failed to create project 1")

	time.Sleep(10 * time.Millisecond) // Ensure different timestamps

	created2, err := store.Create(ctx, project2)
	require.NoError(t, err, "Failed to create project 2")

	time.Sleep(10 * time.Millisecond)

	created3, err := store.Create(ctx, project3)
	require.NoError(t, err, "Failed to create project 3")

	tests := []struct {
		name        string
		filters     *GetFilters
		wantCount   int
		description string
	}{
		{
			name: "get all projects",
			filters: &GetFilters{
				IncludeDeleted: false,
			},
			wantCount:   3,
			description: "Should return all active projects",
		},
		{
			name: "get projects by alias",
			filters: &GetFilters{
				Alias:          stringPtr("@alpha"),
				IncludeDeleted: false,
			},
			wantCount:   1,
			description: "Should return project with matching alias",
		},
		{
			name: "get projects by name like",
			filters: &GetFilters{
				NameLike:       stringPtr("Beta"),
				IncludeDeleted: false,
			},
			wantCount:   1,
			description: "Should return projects with matching name",
		},
		{
			name: "get active projects",
			filters: &GetFilters{
				Ongoing:        boolPtr(true),
				IncludeDeleted: false,
			},
			wantCount:   3,
			description: "Should return active (non-deleted) projects",
		},
		{
			name: "get projects including deleted",
			filters: &GetFilters{
				IncludeDeleted: true,
			},
			wantCount:   3,
			description: "Should return all projects including deleted",
		},
		{
			name: "get projects with no matches",
			filters: &GetFilters{
				Alias:          stringPtr("@non-existent"),
				IncludeDeleted: false,
			},
			wantCount:   0,
			description: "Should return empty list for no matches",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			projects, err := store.Get(ctx, tt.filters)
			require.NoError(t, err, "Get() failed: %v", err)
			assert.Len(t, projects, tt.wantCount, "Get() returned wrong number of projects")

			// Verify projects are ordered by created_at DESC
			if len(projects) > 1 {
				for i := 1; i < len(projects); i++ {
					assert.True(t, projects[i-1].CreatedAt >= projects[i].CreatedAt,
						"Projects should be ordered by created_at DESC")
				}
			}
		})
	}

	// Test with soft deleted project (archived)
	err = store.SoftDelete(ctx, created2.ID)
	require.NoError(t, err, "Failed to soft delete project 2")

	// Soft delete project 3 as well to have multiple archived projects
	err = store.SoftDelete(ctx, created3.ID)
	require.NoError(t, err, "Failed to soft delete project 3")

	t.Run("get archived projects", func(t *testing.T) {
		filters := &GetFilters{
			Archived: boolPtr(true),
		}
		projects, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, projects, 2, "Should return 2 archived (soft deleted) projects")

		// Verify archived projects are in results
		archivedIDs := make(map[string]bool)
		for _, project := range projects {
			archivedIDs[project.ID] = true
		}
		assert.True(t, archivedIDs[created2.ID], "Project 2 should be archived")
		assert.True(t, archivedIDs[created3.ID], "Project 3 should be archived")
	})

	t.Run("get projects excluding deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: false,
		}
		projects, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, projects, 1, "Should exclude soft deleted projects")

		// Verify deleted projects are not in results
		for _, project := range projects {
			assert.NotEqual(t, created2.ID, project.ID, "Should not include soft deleted project 2")
			assert.NotEqual(t, created3.ID, project.ID, "Should not include soft deleted project 3")
		}
	})

	t.Run("get projects including deleted", func(t *testing.T) {
		filters := &GetFilters{
			IncludeDeleted: true,
		}
		projects, err := store.Get(ctx, filters)
		require.NoError(t, err, "Get() failed: %v", err)
		assert.Len(t, projects, 3, "Should include soft deleted projects")
	})
}

func TestStore_GetByIDTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	project, err := New("Get Tx Test Project", "get-tx-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for GetByIDTx test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create test project")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	result, err := store.GetByIDTx(ctx, tx, created.ID)
	require.NoError(t, err, "GetByIDTx() failed")
	require.NotNil(t, result, "GetByIDTx() returned nil project")

	assert.Equal(t, created.ID, result.ID, "Project ID mismatch")
	assert.Equal(t, "Get Tx Test Project", result.Name, "Project name mismatch")
	assert.Equal(t, "@get-tx-test", result.Alias, "Project alias mismatch")
	assert.Equal(t, "2024-01-01", result.StartDate, "Project start_date mismatch")
	assert.Equal(t, "2024-12-31", result.EndDate, "Project end_date mismatch")

	_, err = store.GetByIDTx(ctx, tx, "non-existent-id")
	assert.Error(t, err, "GetByIDTx() should error for non-existent project")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_GetTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	proj1, err := New("Get Tx Project 1", "get-tx-1", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project 1")

	proj2, err := New("Get Tx Project 2", "get-tx-2", "2024-02-01", "")
	require.NoError(t, err, "Failed to create project 2")

	created1, err := store.Create(ctx, proj1)
	require.NoError(t, err, "Failed to create project 1")

	time.Sleep(10 * time.Millisecond)

	created2, err := store.Create(ctx, proj2)
	require.NoError(t, err, "Failed to create project 2")

	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	filters := &GetFilters{
		IncludeDeleted: false,
	}

	projects, err := store.GetTx(ctx, tx, filters)
	require.NoError(t, err, "GetTx() failed")
	require.Len(t, projects, 2, "Should return 2 projects")

	assert.Equal(t, created2.ID, projects[0].ID, "First project ID mismatch (should be ordered by created_at DESC)")
	assert.Equal(t, created1.ID, projects[1].ID, "Second project ID mismatch")

	aliasFilters := &GetFilters{
		Alias:          &[]string{"@get-tx-1"}[0],
		IncludeDeleted: false,
	}

	filteredProjects, err := store.GetTx(ctx, tx, aliasFilters)
	require.NoError(t, err, "GetTx() with alias filter failed")
	require.Len(t, filteredProjects, 1, "Should return 1 filtered project")
	assert.Equal(t, "@get-tx-1", filteredProjects[0].Alias, "Filtered project alias mismatch")

	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")
}

func TestStore_Update(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("Original Project", "original", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for update test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for update test")

	// Wait a bit to ensure updated_at changes
	time.Sleep(10 * time.Millisecond)

	tests := []struct {
		name        string
		project     *Project
		wantError   bool
		description string
	}{
		{
			name: "update all fields",
			project: func() *Project {
				p, _ := New("Updated Project", "updated", "2024-02-01", "2024-11-30")
				p.ID = created.ID
				return p
			}(),
			wantError:   false,
			description: "Should update all project fields",
		},
		{
			name: "update with empty alias",
			project: func() *Project {
				p, _ := New("Updated Project 2", "", "2024-03-01", "")
				p.ID = created.ID
				return p
			}(),
			wantError:   false,
			description: "Should update project with empty alias",
		},
		{
			name: "update non-existent project",
			project: func() *Project {
				p, _ := New("Non-existent", "non-existent", "2024-01-01", "2024-12-31")
				p.ID = "non-existent-id"
				return p
			}(),
			wantError:   true, // Update with no matching rows should error
			description: "Should error when updating non-existent project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := store.Update(ctx, tt.project)

			if tt.wantError {
				assert.Error(t, err, "Update() expected error but got none")
				return
			}

			require.NoError(t, err, "Update() unexpected error: %v", err)
			require.NotNil(t, result, "Update() returned nil project")

			// Verify the update (only for existing projects)
			if tt.project.ID == created.ID {
				retrieved, err := store.GetByID(ctx, tt.project.ID)
				require.NoError(t, err, "GetByID() failed to retrieve updated project")

				assert.Equal(t, tt.project.Name, retrieved.Name, "Project name mismatch")
				assert.Equal(t, tt.project.Alias, retrieved.Alias, "Project alias mismatch")
				assert.Equal(t, tt.project.StartDate, retrieved.StartDate, "Project start_date mismatch")
				assert.Equal(t, tt.project.EndDate, retrieved.EndDate, "Project end_date mismatch")

				// Verify updated_at changed
				assert.NotEqual(t, created.UpdatedAt, retrieved.UpdatedAt, "UpdatedAt should have changed")
			}
		})
	}
}

func TestStore_UpdateTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("Original Project", "original", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for update test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for update test")

	// Update within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	updatedProject, err := New("Transaction Updated Project", "tx-updated", "2024-02-01", "2024-11-30")
	require.NoError(t, err, "Failed to create updated project")
	updatedProject.ID = created.ID

	result, err := store.UpdateTx(ctx, tx, updatedProject)
	require.NoError(t, err, "UpdateTx() failed")
	require.NotNil(t, result, "UpdateTx() returned nil project")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify update persisted
	retrieved, err := store.GetByID(ctx, created.ID)
	require.NoError(t, err, "GetByID() failed to retrieve updated project")
	assert.Equal(t, "Transaction Updated Project", retrieved.Name)
}

func TestStore_SoftDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("To Delete Project", "to-delete", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for delete test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for delete test")

	tests := []struct {
		name        string
		projectID   string
		wantError   bool
		description string
	}{
		{
			name:        "delete existing project",
			projectID:   created.ID,
			wantError:   false,
			description: "Should soft delete existing project",
		},
		{
			name:        "delete non-existent project",
			projectID:   "non-existent-id",
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting non-existent project",
		},
		{
			name:        "delete already deleted project",
			projectID:   created.ID,
			wantError:   true, // Soft delete should error when no rows affected
			description: "Should error when deleting already deleted project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.SoftDelete(ctx, tt.projectID)

			if tt.wantError {
				assert.Error(t, err, "SoftDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "SoftDelete() unexpected error: %v", err)

			// Verify the project is soft deleted (only for existing projects)
			if tt.projectID == created.ID && tt.name == "delete existing project" {
				_, err := store.GetByID(ctx, tt.projectID)
				assert.Error(t, err, "GetByID() should have failed for soft deleted project")

				// Verify it doesn't appear in Get with default filters
				projects, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, project := range projects {
					assert.NotEqual(t, tt.projectID, project.ID, "Soft deleted project should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_SoftDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("To Delete Project", "to-delete", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for delete test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for delete test")

	// Delete within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.SoftDeleteTx(ctx, tx, created.ID)
	require.NoError(t, err, "SoftDeleteTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify deletion persisted
	_, err = store.GetByID(ctx, created.ID)
	assert.Error(t, err, "GetByID() should have failed for soft deleted project")
}

func TestStore_Restore(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create and then soft delete a project
	project, err := New("To Restore Project", "to-restore", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for restore test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for restore test")

	err = store.SoftDelete(ctx, created.ID)
	require.NoError(t, err, "Failed to soft delete project")

	tests := []struct {
		name        string
		projectID   string
		wantError   bool
		description string
	}{
		{
			name:        "restore deleted project",
			projectID:   created.ID,
			wantError:   false,
			description: "Should restore soft deleted project",
		},
		{
			name:        "restore non-existent project",
			projectID:   "non-existent-id",
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring non-existent project",
		},
		{
			name:        "restore already active project",
			projectID:   created.ID,
			wantError:   true, // Restore should error when no rows affected
			description: "Should error when restoring already active project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.Restore(ctx, tt.projectID)

			if tt.wantError {
				assert.Error(t, err, "Restore() expected error but got none")
				return
			}

			require.NoError(t, err, "Restore() unexpected error: %v", err)

			// Verify the project is restored (only for existing projects)
			if tt.projectID == created.ID && tt.name == "restore deleted project" {
				retrieved, err := store.GetByID(ctx, tt.projectID)
				require.NoError(t, err, "GetByID() failed to retrieve restored project")
				assert.Equal(t, "To Restore Project", retrieved.Name)

				// Verify it appears in Get with default filters
				projects, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
				require.NoError(t, err, "Get() failed: %v", err)

				found := false
				for _, project := range projects {
					if project.ID == tt.projectID {
						found = true
						break
					}
				}
				assert.True(t, found, "Restored project should appear in Get results")
			}
		})
	}
}

func TestStore_RestoreTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create and then soft delete a project
	project, err := New("To Restore Project", "to-restore", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for restore test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for restore test")

	err = store.SoftDelete(ctx, created.ID)
	require.NoError(t, err, "Failed to soft delete project")

	// Restore within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.RestoreTx(ctx, tx, created.ID)
	require.NoError(t, err, "RestoreTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify restoration persisted
	retrieved, err := store.GetByID(ctx, created.ID)
	require.NoError(t, err, "GetByID() failed to retrieve restored project")
	assert.Equal(t, "To Restore Project", retrieved.Name)
}

func TestStore_HardDelete(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("To Hard Delete Project", "to-hard-delete", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for hard delete test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for hard delete test")

	tests := []struct {
		name        string
		projectID   string
		wantError   bool
		description string
	}{
		{
			name:        "hard delete existing project",
			projectID:   created.ID,
			wantError:   false,
			description: "Should hard delete existing project",
		},
		{
			name:        "hard delete non-existent project",
			projectID:   "non-existent-id",
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting non-existent project",
		},
		{
			name:        "hard delete already deleted project",
			projectID:   created.ID,
			wantError:   true, // Hard delete should error when no rows affected
			description: "Should error when hard deleting already deleted project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.HardDelete(ctx, tt.projectID)

			if tt.wantError {
				assert.Error(t, err, "HardDelete() expected error but got none")
				return
			}

			require.NoError(t, err, "HardDelete() unexpected error: %v", err)

			// Verify the project is hard deleted (only for existing projects)
			if tt.projectID == created.ID && tt.name == "hard delete existing project" {
				_, err := store.GetByID(ctx, tt.projectID)
				assert.Error(t, err, "GetByID() should have failed for hard deleted project")

				// Verify it doesn't appear in Get with any filters
				projects, err := store.Get(ctx, &GetFilters{IncludeDeleted: true})
				require.NoError(t, err, "Get() failed: %v", err)

				for _, project := range projects {
					assert.NotEqual(t, tt.projectID, project.ID, "Hard deleted project should not appear in Get results")
				}
			}
		})
	}
}

func TestStore_HardDeleteTx(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project first
	project, err := New("To Hard Delete Project", "to-hard-delete", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for hard delete test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for hard delete test")

	// Hard delete within a transaction
	db := store.db
	tx, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction")
	defer tx.Rollback()

	err = store.HardDeleteTx(ctx, tx, created.ID)
	require.NoError(t, err, "HardDeleteTx() failed")

	// Commit transaction
	err = tx.Commit()
	require.NoError(t, err, "Failed to commit transaction")

	// Verify deletion persisted
	_, err = store.GetByID(ctx, created.ID)
	assert.Error(t, err, "GetByID() should have failed for hard deleted project")
}

func TestStore_EdgeCases(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	t.Run("create project with very long name", func(t *testing.T) {
		longName := string(make([]byte, 1000)) // 1000 character string
		for i := range longName {
			longName = longName[:i] + "a" + longName[i+1:]
		}

		project, err := New(longName, "long-name", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create project with long name")

		created, err := store.Create(ctx, project)
		require.NoError(t, err, "Create() with long name failed: %v", err)

		retrieved, err := store.GetByID(ctx, created.ID)
		require.NoError(t, err, "GetByID() failed for long name project: %v", err)
		assert.Len(t, retrieved.Name, 1000, "Project name length mismatch")
	})

	t.Run("create project with special characters in name", func(t *testing.T) {
		specialName := "Project with Special Chars: !@#$%^&*()_+-=[]{}|;':\",./<>?"
		project, err := New(specialName, "special-chars", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create project with special characters")

		created, err := store.Create(ctx, project)
		require.NoError(t, err, "Create() with special characters failed: %v", err)

		retrieved, err := store.GetByID(ctx, created.ID)
		require.NoError(t, err, "GetByID() failed for special characters project: %v", err)
		assert.Equal(t, specialName, retrieved.Name, "Project name mismatch")
	})

	t.Run("create project with unicode characters", func(t *testing.T) {
		unicodeName := "项目名称 with émojis 🚀 and ñ characters"
		project, err := New(unicodeName, "unicode", "2024-01-01", "2024-12-31")
		require.NoError(t, err, "Failed to create project with unicode characters")

		created, err := store.Create(ctx, project)
		require.NoError(t, err, "Create() with unicode characters failed: %v", err)

		retrieved, err := store.GetByID(ctx, created.ID)
		require.NoError(t, err, "GetByID() failed for unicode project: %v", err)
		assert.Equal(t, unicodeName, retrieved.Name, "Project name mismatch")
	})

	t.Run("create project with future dates", func(t *testing.T) {
		futureStart := "2030-01-01"
		futureEnd := "2030-12-31"

		project, err := New("Future Project", "future", futureStart, futureEnd)
		require.NoError(t, err, "Failed to create project with future dates")

		created, err := store.Create(ctx, project)
		require.NoError(t, err, "Create() with future dates failed: %v", err)

		retrieved, err := store.GetByID(ctx, created.ID)
		require.NoError(t, err, "GetByID() failed for future dates project: %v", err)
		assert.Equal(t, futureStart, retrieved.StartDate, "Project start_date mismatch")
		assert.Equal(t, futureEnd, retrieved.EndDate, "Project end_date mismatch")
	})

	t.Run("create project with past dates", func(t *testing.T) {
		pastStart := "2020-01-01"
		pastEnd := "2020-12-31"

		project, err := New("Past Project", "past", pastStart, pastEnd)
		require.NoError(t, err, "Failed to create project with past dates")

		created, err := store.Create(ctx, project)
		require.NoError(t, err, "Create() with past dates failed: %v", err)

		retrieved, err := store.GetByID(ctx, created.ID)
		require.NoError(t, err, "GetByID() failed for past dates project: %v", err)
		assert.Equal(t, pastStart, retrieved.StartDate, "Project start_date mismatch")
		assert.Equal(t, pastEnd, retrieved.EndDate, "Project end_date mismatch")
	})
}

func TestStore_ConcurrentAccess(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Test concurrent creation with proper transaction handling
	const numGoroutines = 10
	results := make(chan string, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			// Retry logic for SQLite BUSY errors
			maxRetries := 10
			for attempt := 0; attempt < maxRetries; attempt++ {
				project, err := New("Concurrent Project "+string(rune('A'+i)), "concurrent-"+string(rune('a'+i)), "2024-01-01", "2024-12-31")
				if err != nil {
					if attempt < maxRetries-1 {
						time.Sleep(time.Millisecond * 10)
						continue
					}
					errors <- err
					return
				}

				created, err := store.Create(ctx, project)
				if err != nil {
					if attempt < maxRetries-1 {
						time.Sleep(time.Millisecond * 10)
						continue
					}
					errors <- err
					return
				}

				// Success!
				results <- created.ID
				return
			}
		}(i)
	}

	// Collect results
	var ids []string
	for i := 0; i < numGoroutines; i++ {
		select {
		case id := <-results:
			ids = append(ids, id)
		case err := <-errors:
			t.Errorf("Concurrent create failed: %v", err)
		}
	}

	assert.Len(t, ids, numGoroutines, "Expected %d concurrent creates, got %d", numGoroutines, len(ids))

	// Verify all projects were created
	projects, err := store.Get(ctx, &GetFilters{IncludeDeleted: false})
	require.NoError(t, err, "Get() failed: %v", err)
	assert.GreaterOrEqual(t, len(projects), numGoroutines, "Expected at least %d projects in Get results", numGoroutines)
}

func TestStore_ContextCancellation(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	// Test with cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	project, err := New("Cancelled Project", "cancelled", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project")

	_, err = store.Create(ctx, project)
	assert.Error(t, err, "Create() with cancelled context should have failed")

	// Test with timeout context
	ctx, cancel = context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()
	time.Sleep(1 * time.Millisecond) // Ensure timeout

	_, err = store.Create(ctx, project)
	assert.Error(t, err, "Create() with timeout context should have failed")
}

func TestStore_TransactionIsolation(t *testing.T) {
	store, cleanup := setupStoreTest(t)
	defer cleanup()

	ctx := context.Background()

	// Create a project
	project, err := New("Isolation Test Project", "isolation-test", "2024-01-01", "2024-12-31")
	require.NoError(t, err, "Failed to create project for isolation test")

	created, err := store.Create(ctx, project)
	require.NoError(t, err, "Failed to create project for isolation test")

	// Start a transaction and update the project
	db := store.db
	tx1, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 1")
	defer tx1.Rollback()

	updatedProject, err := New("Updated in Transaction", "updated-in-tx", "2024-02-01", "2024-11-30")
	require.NoError(t, err, "Failed to create updated project")
	updatedProject.ID = created.ID

	_, err = store.UpdateTx(ctx, tx1, updatedProject)
	require.NoError(t, err, "UpdateTx() failed")

	// In another transaction, try to read the project (should see old data)
	tx2, err := db.BeginTx(ctx, nil)
	require.NoError(t, err, "Failed to begin transaction 2")
	defer tx2.Rollback()

	// Create a temporary store with tx2 for reading
	tempStore := &Store{db: db}

	// This should still see the old data because tx1 hasn't committed
	retrieved, err := tempStore.GetByID(ctx, created.ID)
	require.NoError(t, err, "GetByID() failed")
	assert.Equal(t, "Isolation Test Project", retrieved.Name, "Should see old data before commit")

	// Commit tx1
	err = tx1.Commit()
	require.NoError(t, err, "Failed to commit transaction 1")

	// Now tx2 should still see old data (read committed isolation)
	retrieved, err = tempStore.GetByID(ctx, created.ID)
	require.NoError(t, err, "GetByID() failed")
	assert.Equal(t, "Updated in Transaction", retrieved.Name, "Should see updated data after commit")

	// Commit tx2
	err = tx2.Commit()
	require.NoError(t, err, "Failed to commit transaction 2")
}

// Helper functions for test data
func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
