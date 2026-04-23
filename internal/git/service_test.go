package git

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsNonFastForwardOutput(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"explicit non-fast-forward", "! [rejected] master -> master (non-fast-forward)", true},
		{"fetch first hint", "hint: Updates were rejected because the remote contains work that you do not have locally.\nhint: (e.g. fetch first)", true},
		{"tip behind", "! [rejected] master -> master\nhint: Updates were rejected because the tip of your current branch is behind", true},
		{"auth failure", "remote: Permission to repo denied", false},
		{"timeout style", "fatal: unable to access 'https://...'", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, isNonFastForwardOutput(tc.in))
		})
	}
}

func TestPushNonFastForward(t *testing.T) {
	skipIfNoGit(t)

	ctx := context.Background()
	service := NewService()

	// Set up a bare "remote"
	remoteDir := t.TempDir()
	bareCmd := exec.CommandContext(ctx, "git", "init", "--bare", remoteDir)
	require.NoError(t, bareCmd.Run())

	// Clone A: commits and pushes to create an initial branch on the remote
	cloneA := t.TempDir()
	require.NoError(t, service.Init(ctx, cloneA))
	require.NoError(t, runGit(ctx, cloneA, "config", "user.email", "a@example.com"))
	require.NoError(t, runGit(ctx, cloneA, "config", "user.name", "A"))
	require.NoError(t, service.SetRemote(ctx, cloneA, "origin", remoteDir))
	require.NoError(t, os.WriteFile(filepath.Join(cloneA, "a.txt"), []byte("a"), 0o644))
	require.NoError(t, service.AddAll(ctx, cloneA))
	require.NoError(t, service.Commit(ctx, cloneA, "first"))
	branch, err := service.GetCurrentBranch(ctx, cloneA)
	require.NoError(t, err)
	require.NoError(t, service.Push(ctx, cloneA, "origin", branch))

	// Clone B: clones the remote, commits locally
	cloneB := t.TempDir()
	require.NoError(t, runGit(ctx, "", "clone", remoteDir, cloneB))
	require.NoError(t, runGit(ctx, cloneB, "config", "user.email", "b@example.com"))
	require.NoError(t, runGit(ctx, cloneB, "config", "user.name", "B"))
	require.NoError(t, os.WriteFile(filepath.Join(cloneB, "b.txt"), []byte("b"), 0o644))
	require.NoError(t, service.AddAll(ctx, cloneB))
	require.NoError(t, service.Commit(ctx, cloneB, "from B"))
	require.NoError(t, service.Push(ctx, cloneB, "origin", branch))

	// A commits locally *without* fetching B's changes, then tries to push.
	require.NoError(t, os.WriteFile(filepath.Join(cloneA, "a2.txt"), []byte("a2"), 0o644))
	require.NoError(t, service.AddAll(ctx, cloneA))
	require.NoError(t, service.Commit(ctx, cloneA, "second on A"))

	pushErr := service.Push(ctx, cloneA, "origin", branch)
	require.Error(t, pushErr)
	assert.True(t, errors.Is(pushErr, ErrNonFastForward), "expected ErrNonFastForward, got: %v", pushErr)

	// PullRebase should succeed (no conflict — different files).
	require.NoError(t, service.PullRebase(ctx, cloneA, "origin", branch))

	// Retry push — should now succeed.
	require.NoError(t, service.Push(ctx, cloneA, "origin", branch))
}

func runGit(ctx context.Context, dir string, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	if dir != "" {
		cmd.Dir = dir
	}
	return cmd.Run()
}

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

		err := service.Init(context.Background(), tempDir)
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
	ctx := context.Background()

	t.Run("initialize repository", func(t *testing.T) {
		err := service.Init(ctx, tempDir)
		require.NoError(t, err)

		gitDir := filepath.Join(tempDir, ".git")
		assert.DirExists(t, gitDir)
	})

	t.Run("init already initialized repo", func(t *testing.T) {
		err := service.Init(ctx, tempDir)
		assert.NoError(t, err)
	})
}

func TestCreateGitIgnore(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
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
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	testFile := filepath.Join(tempDir, "test.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)

	t.Run("add all files", func(t *testing.T) {
		err := service.AddAll(ctx, tempDir)
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
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	testFile := filepath.Join(tempDir, "test.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)

	err = service.AddAll(ctx, tempDir)
	require.NoError(t, err)

	t.Run("commit changes", func(t *testing.T) {
		err := service.Commit(ctx, tempDir, "test commit")
		require.NoError(t, err)

		log, err := getGitLog(tempDir)
		require.NoError(t, err)
		assert.Contains(t, log, "test commit")
	})

	t.Run("commit with no changes", func(t *testing.T) {
		err := service.Commit(ctx, tempDir, "another commit")
		assert.Error(t, err)
	})
}

func TestSetRemote(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	t.Run("set remote", func(t *testing.T) {
		err := service.SetRemote(ctx, tempDir, "origin", "https://github.com/user/repo.git")
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
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	t.Run("push without remote fails", func(t *testing.T) {
		err := service.Push(ctx, tempDir, "origin", "master")
		assert.Error(t, err)
	})
}

func TestGetStatus(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	t.Run("clean status", func(t *testing.T) {
		status, err := service.GetStatus(ctx, tempDir)
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

		status, err := service.GetStatus(ctx, tempDir)
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

func TestGetCurrentBranch(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	// Create an initial commit (required for branch to be valid)
	testFile := filepath.Join(tempDir, "test.txt")
	err = os.WriteFile(testFile, []byte("test content"), 0644)
	require.NoError(t, err)
	err = service.AddAll(ctx, tempDir)
	require.NoError(t, err)
	err = service.Commit(ctx, tempDir, "initial commit")
	require.NoError(t, err)

	t.Run("get current branch", func(t *testing.T) {
		branch, err := service.GetCurrentBranch(ctx, tempDir)
		require.NoError(t, err)
		// Could be "master" or "main" depending on git config
		assert.True(t, branch == "master" || branch == "main", "Expected master or main, got: %s", branch)
	})
}

func TestHasRemote(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	t.Run("no remote", func(t *testing.T) {
		hasRemote, err := service.HasRemote(ctx, tempDir, "origin")
		require.NoError(t, err)
		assert.False(t, hasRemote)
	})

	t.Run("with remote", func(t *testing.T) {
		err := service.SetRemote(ctx, tempDir, "origin", "https://github.com/user/repo.git")
		require.NoError(t, err)

		hasRemote, err := service.HasRemote(ctx, tempDir, "origin")
		require.NoError(t, err)
		assert.True(t, hasRemote)
	})
}

func TestGetLastCommitHash(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	t.Run("no commits yet", func(t *testing.T) {
		hash, err := service.GetLastCommitHash(ctx, tempDir)
		require.NoError(t, err)
		assert.Empty(t, hash)
	})

	t.Run("with commit", func(t *testing.T) {
		testFile := filepath.Join(tempDir, "test.txt")
		err = os.WriteFile(testFile, []byte("test content"), 0644)
		require.NoError(t, err)
		err = service.AddAll(ctx, tempDir)
		require.NoError(t, err)
		err = service.Commit(ctx, tempDir, "test commit")
		require.NoError(t, err)

		hash, err := service.GetLastCommitHash(ctx, tempDir)
		require.NoError(t, err)
		assert.NotEmpty(t, hash)
		assert.Len(t, hash, 7) // Short hash is typically 7 characters
	})
}

func TestFetch(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	t.Run("fetch without remote fails", func(t *testing.T) {
		err := service.Fetch(ctx, tempDir, "origin")
		assert.Error(t, err)
	})
}

func TestValidateRepoPath(t *testing.T) {
	service := NewService()

	t.Run("empty path", func(t *testing.T) {
		err := service.validateRepoPath("")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "empty")
	})

	t.Run("non-existent path", func(t *testing.T) {
		err := service.validateRepoPath("/non/existent/path")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "does not exist")
	})

	t.Run("valid directory", func(t *testing.T) {
		tempDir := t.TempDir()
		err := service.validateRepoPath(tempDir)
		assert.NoError(t, err)
	})
}

func TestAddAllWithPathValidation(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	ctx := context.Background()

	t.Run("fails with empty path", func(t *testing.T) {
		err := service.AddAll(ctx, "")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "empty")
	})

	t.Run("fails with non-existent path", func(t *testing.T) {
		err := service.AddAll(ctx, "/non/existent/path")
		assert.Error(t, err)
	})
}

func TestGetStatusExtended(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	t.Run("detects deleted files", func(t *testing.T) {
		// Create and commit a file
		testFile := filepath.Join(tempDir, "to-delete.txt")
		err := os.WriteFile(testFile, []byte("content"), 0644)
		require.NoError(t, err)
		require.NoError(t, service.AddAll(ctx, tempDir))
		require.NoError(t, service.Commit(ctx, tempDir, "add file"))

		// Delete the file
		require.NoError(t, os.Remove(testFile))

		status, err := service.GetStatus(ctx, tempDir)
		require.NoError(t, err)
		assert.False(t, status.Clean)
		assert.Contains(t, status.Deleted, "to-delete.txt")
	})

	t.Run("status struct has all fields initialized", func(t *testing.T) {
		status, err := service.GetStatus(ctx, tempDir)
		require.NoError(t, err)
		assert.NotNil(t, status.Modified)
		assert.NotNil(t, status.Untracked)
		assert.NotNil(t, status.Staged)
		assert.NotNil(t, status.Deleted)
		assert.NotNil(t, status.Renamed)
		assert.NotNil(t, status.Conflicted)
	})
}

func TestStashOperations(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	// Create initial commit
	initialFile := filepath.Join(tempDir, "initial.txt")
	err = os.WriteFile(initialFile, []byte("initial"), 0644)
	require.NoError(t, err)
	require.NoError(t, service.AddAll(ctx, tempDir))
	require.NoError(t, service.Commit(ctx, tempDir, "initial commit"))

	t.Run("stash and pop changes", func(t *testing.T) {
		// Modify an existing tracked file (stash only works on tracked files)
		err := os.WriteFile(initialFile, []byte("modified content"), 0644)
		require.NoError(t, err)

		// Verify not clean
		status, err := service.GetStatus(ctx, tempDir)
		require.NoError(t, err)
		assert.False(t, status.Clean)

		// Stash changes
		err = service.Stash(ctx, tempDir)
		require.NoError(t, err)

		// Verify clean after stash
		status, err = service.GetStatus(ctx, tempDir)
		require.NoError(t, err)
		assert.True(t, status.Clean)

		// Pop changes
		err = service.StashPop(ctx, tempDir)
		require.NoError(t, err)

		// Verify changes restored
		status, err = service.GetStatus(ctx, tempDir)
		require.NoError(t, err)
		assert.False(t, status.Clean)

		// Restore the original content to leave repo in clean state
		require.NoError(t, service.AddAll(ctx, tempDir))
		require.NoError(t, service.Commit(ctx, tempDir, "commit modified"))
	})

	t.Run("stash pop with no stash entries", func(t *testing.T) {
		// Should not error when no stash entries
		err := service.StashPop(ctx, tempDir)
		assert.NoError(t, err)
	})
}

func TestGetAheadBehind(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	// Create initial commit
	initialFile := filepath.Join(tempDir, "initial.txt")
	err = os.WriteFile(initialFile, []byte("initial"), 0644)
	require.NoError(t, err)
	require.NoError(t, service.AddAll(ctx, tempDir))
	require.NoError(t, service.Commit(ctx, tempDir, "initial commit"))

	t.Run("no remote returns zero", func(t *testing.T) {
		ab, err := service.GetAheadBehind(ctx, tempDir, "master")
		require.NoError(t, err)
		assert.Equal(t, 0, ab.Ahead)
		assert.Equal(t, 0, ab.Behind)
	})
}

func TestRetryConfig(t *testing.T) {
	t.Run("default config has sensible values", func(t *testing.T) {
		cfg := DefaultRetryConfig()
		assert.Equal(t, 3, cfg.MaxRetries)
		assert.True(t, cfg.InitialBackoff > 0)
		assert.True(t, cfg.MaxBackoff >= cfg.InitialBackoff)
	})
}

func TestServiceInstanceIsolation(t *testing.T) {
	// Test that each Service instance has its own configuredRepos
	service1 := NewService()
	service2 := NewService()

	// They should be different instances
	assert.NotSame(t, service1, service2)
}

func TestGetBranches(t *testing.T) {
	skipIfNoGit(t)

	service := NewService()
	tempDir := t.TempDir()
	ctx := context.Background()

	err := service.Init(ctx, tempDir)
	require.NoError(t, err)

	configureGitUser(t, tempDir)

	// Create initial commit on master/main
	initialFile := filepath.Join(tempDir, "initial.txt")
	err = os.WriteFile(initialFile, []byte("initial"), 0644)
	require.NoError(t, err)
	require.NoError(t, service.AddAll(ctx, tempDir))
	require.NoError(t, service.Commit(ctx, tempDir, "initial commit"))

	t.Run("returns at least one branch", func(t *testing.T) {
		branches, err := service.GetBranches(ctx, tempDir)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(branches), 1)
	})

	t.Run("returns current branch in list", func(t *testing.T) {
		currentBranch, err := service.GetCurrentBranch(ctx, tempDir)
		require.NoError(t, err)

		branches, err := service.GetBranches(ctx, tempDir)
		require.NoError(t, err)
		assert.Contains(t, branches, currentBranch)
	})
}
