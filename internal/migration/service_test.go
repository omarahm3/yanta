package migration

import (
	"os"
	"path/filepath"
	"testing"
	"yanta/internal/config"
	"yanta/internal/db"
	"yanta/internal/testutil"

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
		cleanup := testutil.SetTestHome(t, tempDir)
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
		cleanup := testutil.SetTestHome(t, tempHome)
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

		err = service.MigrateData(newDataDir)
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

func TestRollback(t *testing.T) {
	t.Run("rollback cleans up partial migration", func(t *testing.T) {
		tempHome := t.TempDir()
		config.ResetForTesting()
		cleanup := testutil.SetTestHome(t, tempHome)
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

func (m *mockGitService) Init(path string) error {
	m.initCalled = true
	return nil
}

func (m *mockGitService) CreateGitIgnore(path string, patterns []string) error {
	m.createGitIgnoreCalled = true
	return nil
}

func (m *mockGitService) AddAll(path string) error {
	return nil
}

func (m *mockGitService) Commit(path, message string) error {
	m.commitCalled = true
	return nil
}
