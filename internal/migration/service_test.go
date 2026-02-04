package migration

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/testenv"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateTargetDirectory(t *testing.T) {
	service := NewService(nil, nil)

	t.Run("empty directory is valid", func(t *testing.T) {
		tempDir := t.TempDir()
		err := service.ValidateTargetDirectory(tempDir)
		assert.NoError(t, err)
	})

	t.Run("non-existent directory can be created", func(t *testing.T) {
		tempDir := t.TempDir()
		newDir := filepath.Join(tempDir, "new-dir")
		err := service.ValidateTargetDirectory(newDir)
		assert.NoError(t, err)
	})

	t.Run("directory with existing vault is accepted", func(t *testing.T) {
		// Migration to ANY directory is allowed!
		// Target can have vault (will use it) or not (will copy/create)
		targetDir := t.TempDir()
		targetVaultDir := filepath.Join(targetDir, "vault")
		err := os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)

		// Should be VALID - we allow migration to directories with existing vault
		err = service.ValidateTargetDirectory(targetDir)
		assert.NoError(t, err)
	})

	t.Run("directory with existing database is accepted", func(t *testing.T) {
		// Database will be removed and rebuilt from vault
		targetDir := t.TempDir()

		// Create vault and database in target
		targetVaultDir := filepath.Join(targetDir, "vault")
		err := os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)

		targetDBPath := filepath.Join(targetDir, "yanta.db")
		f, err := os.Create(targetDBPath)
		require.NoError(t, err)
		f.Close()

		// Should be VALID - database will be rebuilt
		err = service.ValidateTargetDirectory(targetDir)
		assert.NoError(t, err)
	})

	t.Run("directory with other files is valid", func(t *testing.T) {
		tempDir := t.TempDir()

		testFile := filepath.Join(tempDir, "readme.md")
		err := os.WriteFile(testFile, []byte("test"), 0644)
		require.NoError(t, err)

		err = service.ValidateTargetDirectory(tempDir)
		assert.NoError(t, err)
	})

	t.Run("same as current directory is rejected", func(t *testing.T) {
		tempDir := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempDir)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		currentDataDir := config.GetDataDirectory()
		err = service.ValidateTargetDirectory(currentDataDir)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "same as current")
	})
}

func TestCopyDirectory(t *testing.T) {
	service := NewService(nil, nil)

	t.Run("copy directory successfully", func(t *testing.T) {
		srcDir := t.TempDir()
		dstDir := t.TempDir()

		testFile := filepath.Join(srcDir, "test.txt")
		err := os.WriteFile(testFile, []byte("test content"), 0644)
		require.NoError(t, err)

		subDir := filepath.Join(srcDir, "subdir")
		err = os.MkdirAll(subDir, 0755)
		require.NoError(t, err)

		subFile := filepath.Join(subDir, "sub.txt")
		err = os.WriteFile(subFile, []byte("sub content"), 0644)
		require.NoError(t, err)

		err = service.copyDirectory(srcDir, dstDir)
		require.NoError(t, err)

		assert.FileExists(t, filepath.Join(dstDir, "test.txt"))
		assert.DirExists(t, filepath.Join(dstDir, "subdir"))
		assert.FileExists(t, filepath.Join(dstDir, "subdir", "sub.txt"))

		content, err := os.ReadFile(filepath.Join(dstDir, "test.txt"))
		require.NoError(t, err)
		assert.Equal(t, "test content", string(content))
	})

	t.Run("copy empty directory", func(t *testing.T) {
		srcDir := t.TempDir()
		dstDir := filepath.Join(t.TempDir(), "dst")

		err := service.copyDirectory(srcDir, dstDir)
		require.NoError(t, err)
		assert.DirExists(t, dstDir)
	})
}

func TestVerifyIntegrity(t *testing.T) {
	service := NewService(nil, nil)

	t.Run("identical directories pass verification", func(t *testing.T) {
		srcDir := t.TempDir()
		dstDir := t.TempDir()

		for i := 0; i < 5; i++ {
			filename := filepath.Join(srcDir, filepath.Base(srcDir)+".txt")
			err := os.WriteFile(filename, []byte("content"), 0644)
			require.NoError(t, err)
		}

		err := service.copyDirectory(srcDir, dstDir)
		require.NoError(t, err)

		err = service.verifyIntegrity(srcDir, dstDir)
		assert.NoError(t, err)
	})

	t.Run("missing files fail verification", func(t *testing.T) {
		srcDir := t.TempDir()
		dstDir := t.TempDir()

		srcFile := filepath.Join(srcDir, "test.txt")
		err := os.WriteFile(srcFile, []byte("content"), 0644)
		require.NoError(t, err)

		err = service.verifyIntegrity(srcDir, dstDir)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "file count mismatch")
	})
}

func TestMigrateData(t *testing.T) {
	t.Run("full migration flow", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		oldDataDir := config.GetDataDirectory()
		vaultDir := filepath.Join(oldDataDir, "vault")
		err = os.MkdirAll(vaultDir, 0755)
		require.NoError(t, err)

		projectDir := filepath.Join(vaultDir, "projects", "@test")
		err = os.MkdirAll(projectDir, 0755)
		require.NoError(t, err)

		testDoc := filepath.Join(projectDir, "doc-test-123.json")
		err = os.WriteFile(testDoc, []byte(`{"id":"123","title":"Test"}`), 0644)
		require.NoError(t, err)

		dbPath := filepath.Join(oldDataDir, "yanta.db")
		database, err := db.OpenDB(dbPath)
		require.NoError(t, err)
		err = db.RunMigrations(database)
		require.NoError(t, err)
		database.Close()

		newDataDir := filepath.Join(tempHome, "git-repo")

		gitService := &mockGitService{
			initCalled:            false,
			createGitIgnoreCalled: false,
			commitCalled:          false,
		}

		service := NewService(nil, gitService)

		err = service.MigrateData(newDataDir, "")
		require.NoError(t, err)

		// Verify vault was copied
		assert.DirExists(t, filepath.Join(newDataDir, "vault"))
		assert.DirExists(t, filepath.Join(newDataDir, "vault", "projects", "@test"))
		assert.FileExists(t, filepath.Join(newDataDir, "vault", "projects", "@test", "doc-test-123.json"))

		// Database should NOT exist - it will be rebuilt from vault on app restart
		assert.NoFileExists(t, filepath.Join(newDataDir, "yanta.db"))

		// Verify config updated
		cfg := config.Get()
		assert.Equal(t, newDataDir, cfg.DataDirectory)

		// Verify git operations
		assert.True(t, gitService.initCalled)
		assert.True(t, gitService.createGitIgnoreCalled)
		assert.True(t, gitService.commitCalled)
	})
}

func TestCheckMigrationConflicts(t *testing.T) {
	t.Run("no conflict when neither has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		targetDir := t.TempDir()
		service := NewService(nil, nil)

		info, err := service.CheckMigrationConflicts(targetDir)
		require.NoError(t, err)
		assert.False(t, info.HasConflict)
		assert.Nil(t, info.LocalVault)
		assert.Nil(t, info.TargetVault)
	})

	t.Run("no conflict when only local has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create local vault
		localDataDir := config.GetDataDirectory()
		localVaultDir := filepath.Join(localDataDir, "vault", "projects", "@test")
		err = os.MkdirAll(localVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(localVaultDir, "doc.json"), []byte("{}"), 0644)
		require.NoError(t, err)

		targetDir := t.TempDir()
		service := NewService(nil, nil)

		info, err := service.CheckMigrationConflicts(targetDir)
		require.NoError(t, err)
		assert.False(t, info.HasConflict)
		assert.NotNil(t, info.LocalVault)
		assert.Nil(t, info.TargetVault)
	})

	t.Run("no conflict when only target has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create target vault
		targetDir := t.TempDir()
		targetVaultDir := filepath.Join(targetDir, "vault", "projects", "@test")
		err = os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(targetVaultDir, "doc.json"), []byte("{}"), 0644)
		require.NoError(t, err)

		service := NewService(nil, nil)

		info, err := service.CheckMigrationConflicts(targetDir)
		require.NoError(t, err)
		assert.False(t, info.HasConflict)
		assert.Nil(t, info.LocalVault)
		assert.NotNil(t, info.TargetVault)
	})

	t.Run("conflict when both have vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create local vault
		localDataDir := config.GetDataDirectory()
		localVaultDir := filepath.Join(localDataDir, "vault", "projects", "@local")
		err = os.MkdirAll(localVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(localVaultDir, "local-doc.json"), []byte(`{"id":"local"}`), 0644)
		require.NoError(t, err)

		// Create target vault
		targetDir := t.TempDir()
		targetVaultDir := filepath.Join(targetDir, "vault", "projects", "@target")
		err = os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(targetVaultDir, "target-doc.json"), []byte(`{"id":"target"}`), 0644)
		require.NoError(t, err)

		service := NewService(nil, nil)

		info, err := service.CheckMigrationConflicts(targetDir)
		require.NoError(t, err)
		assert.True(t, info.HasConflict)
		assert.NotNil(t, info.LocalVault)
		assert.NotNil(t, info.TargetVault)
		assert.Equal(t, 1, info.LocalVault.ProjectCount)
		assert.Equal(t, 1, info.LocalVault.DocumentCount)
		assert.Equal(t, 1, info.TargetVault.ProjectCount)
		assert.Equal(t, 1, info.TargetVault.DocumentCount)
	})

	t.Run("vault stats populated correctly", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create local vault with multiple projects and docs
		localDataDir := config.GetDataDirectory()
		for _, project := range []string{"@project1", "@project2"} {
			projectDir := filepath.Join(localDataDir, "vault", "projects", project)
			err = os.MkdirAll(projectDir, 0755)
			require.NoError(t, err)
			for i := 0; i < 3; i++ {
				docPath := filepath.Join(projectDir, filepath.Base(projectDir)+"-doc.json")
				err = os.WriteFile(docPath, []byte(`{"content":"test"}`), 0644)
				require.NoError(t, err)
			}
		}

		targetDir := t.TempDir()
		service := NewService(nil, nil)

		info, err := service.CheckMigrationConflicts(targetDir)
		require.NoError(t, err)
		assert.NotNil(t, info.LocalVault)
		assert.Equal(t, 2, info.LocalVault.ProjectCount)
		assert.Equal(t, 2, info.LocalVault.DocumentCount) // 1 doc per project (same name overwrites)
		assert.Greater(t, info.LocalVault.TotalSize, int64(0))
		assert.NotEmpty(t, info.LocalVault.TotalSizeHuman)
	})
}

func TestMigrationStrategies(t *testing.T) {
	tests := []struct {
		name           string
		strategy       MigrationStrategy
		setupLocal     func(t *testing.T, localVaultDir string)
		setupTarget    func(t *testing.T, targetVaultDir string)
		verifyResult   func(t *testing.T, targetDir string)
		expectError    bool
		errorContains  string
	}{
		{
			name:     "UseRemote discards local",
			strategy: StrategyUseRemote,
			setupLocal: func(t *testing.T, localVaultDir string) {
				projectDir := filepath.Join(localVaultDir, "projects", "@local")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "local-doc.json"), []byte(`{"id":"local"}`), 0644))
			},
			setupTarget: func(t *testing.T, targetVaultDir string) {
				projectDir := filepath.Join(targetVaultDir, "projects", "@target")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "target-doc.json"), []byte(`{"id":"target"}`), 0644))
			},
			verifyResult: func(t *testing.T, targetDir string) {
				// Target files should exist
				assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@target", "target-doc.json"))
				// Local files should NOT exist
				assert.NoFileExists(t, filepath.Join(targetDir, "vault", "projects", "@local", "local-doc.json"))
			},
		},
		{
			name:     "UseLocal overwrites target",
			strategy: StrategyUseLocal,
			setupLocal: func(t *testing.T, localVaultDir string) {
				projectDir := filepath.Join(localVaultDir, "projects", "@local")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "local-doc.json"), []byte(`{"id":"local"}`), 0644))
			},
			setupTarget: func(t *testing.T, targetVaultDir string) {
				projectDir := filepath.Join(targetVaultDir, "projects", "@target")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "target-doc.json"), []byte(`{"id":"target"}`), 0644))
			},
			verifyResult: func(t *testing.T, targetDir string) {
				// Local files should exist
				assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@local", "local-doc.json"))
				// Target files should NOT exist (overwritten)
				assert.NoFileExists(t, filepath.Join(targetDir, "vault", "projects", "@target", "target-doc.json"))
				// Backup should be cleaned up
				assert.NoDirExists(t, filepath.Join(targetDir, "vault.backup"))
			},
		},
		{
			name:     "MergeBoth preserves both unique files",
			strategy: StrategyMergeBoth,
			setupLocal: func(t *testing.T, localVaultDir string) {
				projectDir := filepath.Join(localVaultDir, "projects", "@local")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "local-doc.json"), []byte(`{"id":"local"}`), 0644))
				// Also add a shared file
				sharedDir := filepath.Join(localVaultDir, "projects", "@shared")
				require.NoError(t, os.MkdirAll(sharedDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(sharedDir, "shared-doc.json"), []byte(`{"id":"local-version"}`), 0644))
			},
			setupTarget: func(t *testing.T, targetVaultDir string) {
				projectDir := filepath.Join(targetVaultDir, "projects", "@target")
				require.NoError(t, os.MkdirAll(projectDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(projectDir, "target-doc.json"), []byte(`{"id":"target"}`), 0644))
				// Also add a shared file with different content
				sharedDir := filepath.Join(targetVaultDir, "projects", "@shared")
				require.NoError(t, os.MkdirAll(sharedDir, 0755))
				require.NoError(t, os.WriteFile(filepath.Join(sharedDir, "shared-doc.json"), []byte(`{"id":"target-version"}`), 0644))
			},
			verifyResult: func(t *testing.T, targetDir string) {
				// Both unique files should exist
				assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@local", "local-doc.json"))
				assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@target", "target-doc.json"))
				// Shared file should have TARGET content (target wins on conflicts)
				content, err := os.ReadFile(filepath.Join(targetDir, "vault", "projects", "@shared", "shared-doc.json"))
				require.NoError(t, err)
				assert.Contains(t, string(content), "target-version")
			},
		},
		{
			name:          "Invalid strategy returns error",
			strategy:      MigrationStrategy("invalid"),
			setupLocal:    func(t *testing.T, localVaultDir string) {},
			setupTarget:   func(t *testing.T, targetVaultDir string) {},
			verifyResult:  func(t *testing.T, targetDir string) {},
			expectError:   true,
			errorContains: "invalid migration strategy",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tempHome := t.TempDir()
			config.ResetForTesting()
			cleanup := testenv.SetTestHome(t, tempHome)
			defer cleanup()

			err := config.Init()
			require.NoError(t, err)

			// Setup local vault
			localDataDir := config.GetDataDirectory()
			localVaultDir := filepath.Join(localDataDir, "vault")
			err = os.MkdirAll(localVaultDir, 0755)
			require.NoError(t, err)
			tc.setupLocal(t, localVaultDir)

			// Setup target vault
			targetDir := filepath.Join(tempHome, "target-repo")
			targetVaultDir := filepath.Join(targetDir, "vault")
			err = os.MkdirAll(targetVaultDir, 0755)
			require.NoError(t, err)
			tc.setupTarget(t, targetVaultDir)

			gitService := &mockGitService{}
			service := NewService(nil, gitService)

			err = service.MigrateData(targetDir, tc.strategy)

			if tc.expectError {
				assert.Error(t, err)
				if tc.errorContains != "" {
					assert.Contains(t, err.Error(), tc.errorContains)
				}
				return
			}

			require.NoError(t, err)
			tc.verifyResult(t, targetDir)

			// Database should be removed (will be rebuilt)
			assert.NoFileExists(t, filepath.Join(targetDir, "yanta.db"))

			// Git should be initialized
			assert.True(t, gitService.initCalled)
		})
	}
}

func TestMigrationStrategyIsValid(t *testing.T) {
	tests := []struct {
		strategy MigrationStrategy
		valid    bool
	}{
		{StrategyUseRemote, true},
		{StrategyUseLocal, true},
		{StrategyMergeBoth, true},
		{MigrationStrategy("invalid"), false},
		{MigrationStrategy(""), false},
	}

	for _, tc := range tests {
		t.Run(string(tc.strategy), func(t *testing.T) {
			assert.Equal(t, tc.valid, tc.strategy.IsValid())
		})
	}
}

func TestMigrateDataNoConflict(t *testing.T) {
	t.Run("no conflict - only local has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create local vault
		localDataDir := config.GetDataDirectory()
		localVaultDir := filepath.Join(localDataDir, "vault", "projects", "@test")
		err = os.MkdirAll(localVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(localVaultDir, "doc.json"), []byte(`{}`), 0644)
		require.NoError(t, err)

		// Empty target
		targetDir := filepath.Join(tempHome, "target-repo")

		gitService := &mockGitService{}
		service := NewService(nil, gitService)

		// Strategy should be ignored when there's no conflict
		err = service.MigrateData(targetDir, StrategyUseRemote)
		require.NoError(t, err)

		// Local vault should be copied
		assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@test", "doc.json"))
	})

	t.Run("no conflict - only target has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create target vault
		targetDir := filepath.Join(tempHome, "target-repo")
		targetVaultDir := filepath.Join(targetDir, "vault", "projects", "@test")
		err = os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(targetVaultDir, "doc.json"), []byte(`{}`), 0644)
		require.NoError(t, err)

		gitService := &mockGitService{}
		service := NewService(nil, gitService)

		err = service.MigrateData(targetDir, "")
		require.NoError(t, err)

		// Target vault should still exist
		assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@test", "doc.json"))
	})

	t.Run("fresh vault - neither has vault", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		targetDir := filepath.Join(tempHome, "target-repo")

		gitService := &mockGitService{}
		service := NewService(nil, gitService)

		err = service.MigrateData(targetDir, "")
		require.NoError(t, err)

		// Fresh vault structure should be created
		assert.DirExists(t, filepath.Join(targetDir, "vault", "projects"))
	})
}

func TestDefaultStrategyBehavior(t *testing.T) {
	t.Run("empty strategy defaults to use_remote", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		// Create local vault
		localDataDir := config.GetDataDirectory()
		localVaultDir := filepath.Join(localDataDir, "vault", "projects", "@local")
		err = os.MkdirAll(localVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(localVaultDir, "local.json"), []byte(`{}`), 0644)
		require.NoError(t, err)

		// Create target vault
		targetDir := filepath.Join(tempHome, "target-repo")
		targetVaultDir := filepath.Join(targetDir, "vault", "projects", "@target")
		err = os.MkdirAll(targetVaultDir, 0755)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(targetVaultDir, "target.json"), []byte(`{}`), 0644)
		require.NoError(t, err)

		gitService := &mockGitService{}
		service := NewService(nil, gitService)

		// Empty strategy should default to use_remote
		err = service.MigrateData(targetDir, "")
		require.NoError(t, err)

		// Target files should exist, local should not
		assert.FileExists(t, filepath.Join(targetDir, "vault", "projects", "@target", "target.json"))
		assert.NoFileExists(t, filepath.Join(targetDir, "vault", "projects", "@local", "local.json"))
	})
}

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		bytes    int64
		expected string
	}{
		{0, "0 B"},
		{100, "100 B"},
		{1023, "1023 B"},
		{1024, "1.0 KB"},
		{1536, "1.5 KB"},
		{1048576, "1.0 MB"},
		{1073741824, "1.0 GB"},
	}

	for _, tc := range tests {
		t.Run(tc.expected, func(t *testing.T) {
			result := formatBytes(tc.bytes)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetVaultStatsEmpty(t *testing.T) {
	service := NewService(nil, nil)

	t.Run("empty vault directory", func(t *testing.T) {
		vaultDir := t.TempDir()

		stats, err := service.getVaultStats(vaultDir)
		require.NoError(t, err)
		assert.Equal(t, 0, stats.ProjectCount)
		assert.Equal(t, 0, stats.DocumentCount)
		assert.Equal(t, int64(0), stats.TotalSize)
		assert.Equal(t, "0 B", stats.TotalSizeHuman)
	})

	t.Run("vault with projects folder but no projects", func(t *testing.T) {
		vaultDir := t.TempDir()
		projectsDir := filepath.Join(vaultDir, "projects")
		err := os.MkdirAll(projectsDir, 0755)
		require.NoError(t, err)

		stats, err := service.getVaultStats(vaultDir)
		require.NoError(t, err)
		assert.Equal(t, 0, stats.ProjectCount)
		assert.Equal(t, 0, stats.DocumentCount)
	})
}

func TestRollback(t *testing.T) {
	t.Run("rollback cleans up partial migration", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testenv.SetTestHome(t, tempHome)
		defer cleanup()

		err := config.Init()
		require.NoError(t, err)

		oldDataDir := config.GetDataDirectory()
		targetDir := filepath.Join(tempHome, "target")

		err = os.MkdirAll(filepath.Join(targetDir, "vault"), 0755)
		require.NoError(t, err)

		testFile := filepath.Join(targetDir, "vault", "test.txt")
		err = os.WriteFile(testFile, []byte("test"), 0644)
		require.NoError(t, err)

		service := NewService(nil, nil)
		err = service.rollback(targetDir, oldDataDir)
		require.NoError(t, err)

		assert.NoDirExists(t, filepath.Join(targetDir, "vault"))

		cfg := config.Get()
		assert.Equal(t, oldDataDir, cfg.DataDirectory)
	})
}

type mockGitService struct {
	initCalled            bool
	createGitIgnoreCalled bool
	commitCalled          bool
}

func (m *mockGitService) CheckInstalled() (bool, error) {
	return true, nil
}

func (m *mockGitService) IsRepository(path string) (bool, error) {
	return false, nil
}

func (m *mockGitService) Init(_ context.Context, path string) error {
	m.initCalled = true
	return nil
}

func (m *mockGitService) CreateGitIgnore(path string, patterns []string) error {
	m.createGitIgnoreCalled = true
	return nil
}

func (m *mockGitService) AddAll(_ context.Context, path string) error {
	return nil
}

func (m *mockGitService) Commit(_ context.Context, path, message string) error {
	m.commitCalled = true
	return nil
}
