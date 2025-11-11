package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckInstalled(t *testing.T) {
	service := NewService()

	t.Run("git is installed", func(t *testing.T) {
		installed, err := service.CheckInstalled()
		if err != nil {
			t.Skip("git not available in test environment")
		}
		assert.True(t, installed)
	})
}

func TestIsRepository(t *testing.T) {
	service := NewService()
	tempDir := t.TempDir()

	t.Run("not a repository", func(t *testing.T) {
		isRepo, err := service.IsRepository(tempDir)
		require.NoError(t, err)
		assert.False(t, isRepo)
	})

	t.Run("is a repository after init", func(t *testing.T) {
		skipIfNoGit(t)

		err := service.Init(tempDir)
		require.NoError(t, err)

		isRepo, err := service.IsRepository(tempDir)
		require.NoError(t, err)
		assert.True(t, isRepo)
	})
}

func TestInit(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	t.Run("initialize repository", func(t *testing.T) {
		err := service.Init(tempDir)
		require.NoError(t, err)

		gitDir := filepath.Join(tempDir, ".git")
		assert.DirExists(t, gitDir)
	})

	t.Run("init already initialized repo", func(t *testing.T) {
		err := service.Init(tempDir)
		assert.NoError(t, err)
	})
}

func TestCreateGitIgnore(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	t.Run("create gitignore", func(t *testing.T) {
		patterns := []string{
			"yanta.db*",
			"logs/",
			"*.tmp",
		}

		err := service.CreateGitIgnore(tempDir, patterns)
		require.NoError(t, err)

		gitignorePath := filepath.Join(tempDir, ".gitignore")
		assert.FileExists(t, gitignorePath)

		content, err := os.ReadFile(gitignorePath)
		require.NoError(t, err)

		assert.Contains(t, string(content), "yanta.db*")
		assert.Contains(t, string(content), "logs/")
		assert.Contains(t, string(content), "*.tmp")
	})
}

func TestAddAll(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	testFile := filepath.Join(tempDir, "test.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)

	t.Run("add all files", func(t *testing.T) {
		err := service.AddAll(tempDir)
		require.NoError(t, err)

		status, err := getGitStatus(tempDir)
		require.NoError(t, err)
		assert.Contains(t, status, "test.txt")
	})
}

func TestCommit(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	testFile := filepath.Join(tempDir, "test.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)

	err = service.AddAll(tempDir)
	require.NoError(t, err)

	t.Run("commit changes", func(t *testing.T) {
		err := service.Commit(tempDir, "test commit")
		require.NoError(t, err)

		log, err := getGitLog(tempDir)
		require.NoError(t, err)
		assert.Contains(t, log, "test commit")
	})

	t.Run("commit with no changes", func(t *testing.T) {
		err := service.Commit(tempDir, "another commit")
		assert.Error(t, err)
	})
}

func TestSetRemote(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	t.Run("set remote", func(t *testing.T) {
		err := service.SetRemote(tempDir, "origin", "https://github.com/user/repo.git")
		require.NoError(t, err)

		remotes, err := getGitRemotes(tempDir)
		require.NoError(t, err)
		assert.Contains(t, remotes, "origin")
		// Git may rewrite URLs based on global config (e.g., https -> ssh)
		// Check that the remote exists with either the original URL or a rewritten one
		hasOriginal := strings.Contains(remotes, "https://github.com/user/repo.git")
		hasRewritten := strings.Contains(remotes, "ssh://git@github.com/user/repo.git")
		assert.True(t, hasOriginal || hasRewritten, "Remote should contain either HTTPS or SSH URL, got: %s", remotes)
	})
}

func TestPush(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	t.Run("push without remote fails", func(t *testing.T) {
		err := service.Push(tempDir, "origin", "master")
		assert.Error(t, err)
	})
}

func TestGetStatus(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()

	err := service.Init(tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	t.Run("clean status", func(t *testing.T) {
		status, err := service.GetStatus(tempDir)
		require.NoError(t, err)
		assert.NotNil(t, status)
		assert.True(t, status.Clean)
		assert.Empty(t, status.Modified)
		assert.Empty(t, status.Untracked)
	})

	t.Run("with untracked file", func(t *testing.T) {
		testFile := filepath.Join(tempDir, "test.txt")
		err = os.WriteFile(testFile, []byte("test content"), 0644)
		require.NoError(t, err)

		status, err := service.GetStatus(tempDir)
		require.NoError(t, err)
		assert.False(t, status.Clean)
		assert.Contains(t, status.Untracked, "test.txt")
	})
}

func skipIfNoGit(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available in test environment")
	}
}

func configureGitUser(t *testing.T, repoPath string) {
	t.Helper()
	cmd := exec.Command("git", "config", "user.email", "test@example.com")
	cmd.Dir = repoPath
	hideConsoleWindow(cmd)
	require.NoError(t, cmd.Run())

	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = repoPath
	hideConsoleWindow(cmd)
	require.NoError(t, cmd.Run())
}

func getGitStatus(repoPath string) (string, error) {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = repoPath
	hideConsoleWindow(cmd)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func getGitLog(repoPath string) (string, error) {
	cmd := exec.Command("git", "log", "--oneline")
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func getGitRemotes(repoPath string) (string, error) {
	cmd := exec.Command("git", "remote", "-v")
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	return string(output), err
}
