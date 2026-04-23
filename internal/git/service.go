// Package git provides Git repository operations and synchronization management.
package git

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"yanta/internal/logger"
)

type Service struct {
	configuredRepos sync.Map
}

const maxGitOutputChars = 4000

func NewService() *Service {
	return &Service{}
}

func (s *Service) validateRepoPath(path string) error {
	if path == "" {
		return fmt.Errorf("repository path is empty")
	}

	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return fmt.Errorf("repository path does not exist: %s", path)
	}
	if err != nil {
		return fmt.Errorf("cannot access repository path %q: %w", path, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("repository path is not a directory: %s", path)
	}

	return nil
}

func (s *Service) newGitCmd(ctx context.Context, repoPath string, args ...string) *exec.Cmd {
	fullArgs := append([]string{"-C", repoPath}, args...)
	cmd := exec.CommandContext(ctx, "git", fullArgs...)
	cmd.Dir = repoPath
	hideConsoleWindow(cmd)

	env := append([]string{}, os.Environ()...)
	filteredEnv := make([]string, 0, len(env))
	for _, e := range env {
		if !strings.HasPrefix(e, "GIT_CONFIG_") {
			filteredEnv = append(filteredEnv, e)
		}
	}

	filteredEnv = append(filteredEnv,
		"GIT_CONFIG_COUNT=2",
		"GIT_CONFIG_KEY_0=core.autocrlf",
		"GIT_CONFIG_VALUE_0=false",
		"GIT_CONFIG_KEY_1=core.safecrlf",
		"GIT_CONFIG_VALUE_1=false",
	)
	cmd.Env = filteredEnv

	return cmd
}

type Status struct {
	Clean      bool
	Modified   []string
	Untracked  []string
	Staged     []string
	Deleted    []string
	Renamed    []string
	Conflicted []string
}

func (s *Service) CheckInstalled() (bool, error) {
	_, err := exec.LookPath("git")
	if err != nil {
		return false, nil
	}
	return true, nil
}

func (s *Service) IsRepository(path string) (bool, error) {
	gitDir := filepath.Join(path, ".git")
	info, err := os.Stat(gitDir)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("checking .git directory: %w", err)
	}
	return info.IsDir(), nil
}

func (s *Service) Init(ctx context.Context, path string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "init")

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git init timed out after 30s")
		}
		return fmt.Errorf("git init failed: %w: %s", err, stderr.String())
	}

	s.ensureLFConfig(ctx, path)
	return nil
}

func (s *Service) CreateGitIgnore(path string, patterns []string) error {
	gitignorePath := filepath.Join(path, ".gitignore")

	content := "# YANTA - Auto-generated .gitignore\n\n"
	for _, pattern := range patterns {
		content += pattern + "\n"
	}

	if err := os.WriteFile(gitignorePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("writing .gitignore: %w", err)
	}

	return nil
}

func (s *Service) AddAll(ctx context.Context, path string) error {
	if err := s.validateRepoPath(path); err != nil {
		return fmt.Errorf("git add: %w", err)
	}

	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	logger.WithField("path", path).Debug("git add: staging all changes")

	cmd := s.newGitCmd(ctx, path, "add", "-A")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git add timed out after 30s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		return fmt.Errorf("git add failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	stdoutStr := strings.TrimSpace(stdout.String())
	stderrStr := strings.TrimSpace(stderr.String())
	if stdoutStr != "" || stderrStr != "" {
		logger.WithFields(map[string]any{
			"stdout": stdoutStr,
			"stderr": stderrStr,
		}).Debug("git add output")
	}

	return nil
}

func (s *Service) Commit(ctx context.Context, path, message string) error {
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "commit", "-m", message)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git commit timed out after 10s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if output != "" {
			logger.Debugf("git commit output (error):\n%s", boundOutput(output))
		}
		if strings.Contains(output, "nothing to commit") || strings.Contains(output, "nothing added to commit") {
			return fmt.Errorf("nothing to commit")
		}
		if strings.Contains(output, "Author identity unknown") || strings.Contains(output, "Please tell me who you are") {
			return fmt.Errorf("GIT_IDENTITY_NOT_CONFIGURED:\nGit identity not configured.\n\nYou need to configure your git identity before using git sync.\n\nRun these commands in your terminal:\n\n  git config --global user.name \"Your Name\"\n  git config --global user.email \"your.email@example.com\"")
		}
		return fmt.Errorf("git commit failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	logger.Debugf("git commit output:\n%s\n%s", stdout.String(), stderr.String())
	return nil
}

func (s *Service) SetRemote(ctx context.Context, path, name, url string) error {
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "remote", "add", name, url)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git remote add timed out")
		}
		errMsg := stderr.String()
		if strings.Contains(errMsg, "already exists") {
			cmd = s.newGitCmd(ctx, path, "remote", "set-url", name, url)
			cmd.Stderr = &stderr
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("git remote set-url failed: %w: %s", err, stderr.String())
			}
			return nil
		}
		return fmt.Errorf("git remote add failed: %w: %s", err, errMsg)
	}

	return nil
}

// ErrNonFastForward signals that `git push` was rejected because the remote
// branch has diverged (remote is ahead). Callers can use errors.Is to detect
// this and trigger a pull-rebase + retry.
var ErrNonFastForward = fmt.Errorf("non-fast-forward: remote branch is ahead")

func (s *Service) Push(ctx context.Context, path, remote, branch string) error {
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "push", remote, branch)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git push timed out after 30s\n\nThis usually means:\n- Network connectivity issues\n- Authentication required (SSH key or credentials)\n- Remote repository is unreachable\n\nCheck your git configuration and network connection")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if isNonFastForwardOutput(output) {
			return fmt.Errorf("%w\n%s", ErrNonFastForward, boundOutput(output))
		}
		return fmt.Errorf("git push failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	logger.Debugf("git push output:\n%s\n%s", stdout.String(), stderr.String())
	return nil
}

func isNonFastForwardOutput(output string) bool {
	return strings.Contains(output, "non-fast-forward") ||
		strings.Contains(output, "fetch first") ||
		(strings.Contains(output, "rejected") && strings.Contains(output, "tip of your current branch is behind"))
}

// PullRebase runs `git pull --rebase remote branch`. Returns a descriptive
// error on conflicts or unrelated histories, leaving the rebase aborted on
// conflicts so the working tree is restored.
func (s *Service) PullRebase(ctx context.Context, path, remote, branch string) error {
	if err := s.validateRepoPath(path); err != nil {
		return fmt.Errorf("git pull --rebase: %w", err)
	}
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "pull", "--rebase", remote, branch)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git pull --rebase timed out after 60s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())

		if strings.Contains(output, "CONFLICT") || strings.Contains(output, "could not apply") {
			// Abort rebase so the working tree is left clean for the user.
			abortCtx, abortCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer abortCancel()
			abortCmd := s.newGitCmd(abortCtx, path, "rebase", "--abort")
			_ = abortCmd.Run()
			return fmt.Errorf("REBASE_CONFLICT:\nRebase conflicts detected. Rebase was aborted; your working tree is unchanged.\n\n%s\n\nResolve by pulling manually:\n1. 'git pull --rebase' in the data directory\n2. Edit conflicted files (look for <<<<<<<, =======, >>>>>>>)\n3. 'git add <file>' then 'git rebase --continue'", boundOutput(output))
		}
		if strings.Contains(output, "refusing to merge unrelated histories") {
			return fmt.Errorf("UNRELATED_HISTORIES:\nRepositories have unrelated commit histories.\n\n%s", boundOutput(output))
		}
		return fmt.Errorf("git pull --rebase failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	logger.Debugf("git pull --rebase output:\n%s", boundOutput(strings.TrimSpace(stdout.String()+"\n"+stderr.String())))
	return nil
}

func (s *Service) Fetch(ctx context.Context, path, remote string) error {
	if err := s.validateRepoPath(path); err != nil {
		return fmt.Errorf("git fetch: %w", err)
	}

	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	logger.WithFields(map[string]any{
		"path":   path,
		"remote": remote,
	}).Debug("git fetch: fetching from remote")

	cmd := s.newGitCmd(ctx, path, "fetch", remote)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git fetch timed out after 30s\n\nThis usually means:\n- Network connectivity issues\n- Authentication required (SSH key or credentials)\n- Remote repository is unreachable")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		return fmt.Errorf("git fetch failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	logger.Debug("git fetch completed")
	return nil
}

func (s *Service) HasRemote(ctx context.Context, path, remote string) (bool, error) {
	if err := s.validateRepoPath(path); err != nil {
		return false, fmt.Errorf("git remote: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "remote", "get-url", remote)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if cmd.ProcessState != nil && cmd.ProcessState.ExitCode() == 2 {
			return false, nil
		}
		if strings.Contains(stderr.String(), "No such remote") {
			return false, nil
		}
		return false, fmt.Errorf("git remote get-url failed: %w", err)
	}

	return true, nil
}

func (s *Service) GetCurrentBranch(ctx context.Context, path string) (string, error) {
	if err := s.validateRepoPath(path); err != nil {
		return "", fmt.Errorf("git branch: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "rev-parse", "--abbrev-ref", "HEAD")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git rev-parse failed: %w: %s", err, stderr.String())
	}

	return strings.TrimSpace(stdout.String()), nil
}

func (s *Service) GetBranches(ctx context.Context, path string) ([]string, error) {
	if err := s.validateRepoPath(path); err != nil {
		return nil, fmt.Errorf("git branch: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "branch", "--format=%(refname:short)")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git branch failed: %w: %s", err, stderr.String())
	}

	output := strings.TrimSpace(stdout.String())
	if output == "" {
		return []string{}, nil
	}

	branches := strings.Split(output, "\n")
	result := make([]string, 0, len(branches))
	for _, branch := range branches {
		branch = strings.TrimSpace(branch)
		if branch != "" {
			result = append(result, branch)
		}
	}

	return result, nil
}

func (s *Service) GetLastCommitHash(ctx context.Context, path string) (string, error) {
	if err := s.validateRepoPath(path); err != nil {
		return "", fmt.Errorf("git log: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "rev-parse", "--short", "HEAD")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		stderrStr := stderr.String()
		// Return empty string if there are no commits yet
		if strings.Contains(stderrStr, "unknown revision") || strings.Contains(stderrStr, "Needed a single revision") {
			return "", nil
		}
		return "", fmt.Errorf("git rev-parse failed: %w: %s", err, stderrStr)
	}

	return strings.TrimSpace(stdout.String()), nil
}

func (s *Service) Pull(ctx context.Context, path, remote, branch string) error {
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "pull", remote, branch)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git pull timed out after 30s\n\nThis usually means:\n- Network connectivity issues\n- Authentication required (SSH key or credentials)\n- Remote repository is unreachable\n\nCheck your git configuration and network connection")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())

		if strings.Contains(output, "CONFLICT") {
			return fmt.Errorf("MERGE_CONFLICT:\nMerge conflicts detected. Please resolve conflicts manually:\n\n%s\n\nSteps to resolve:\n1. Check conflicted files with 'git status'\n2. Edit files to resolve conflicts (look for <<<<<<<, =======, >>>>>>>)\n3. Stage resolved files with 'git add <file>'\n4. Commit with 'git commit'", boundOutput(output))
		}

		if strings.Contains(output, "divergent branches") || strings.Contains(output, "have diverged") {
			return fmt.Errorf("DIVERGED_BRANCHES:\nLocal and remote branches have diverged.\n\n%s\n\nYou need to:\n1. Review remote changes\n2. Either merge or rebase\n3. Then push your changes", boundOutput(output))
		}

		if strings.Contains(output, "refusing to merge unrelated histories") {
			return fmt.Errorf("UNRELATED_HISTORIES:\nRepositories have unrelated commit histories.\n\n%s\n\nUse 'git pull --allow-unrelated-histories' if you're sure you want to merge.", boundOutput(output))
		}

		return fmt.Errorf("git pull failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), boundOutput(output))
	}

	output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
	logger.Debugf("git pull output:\n%s", boundOutput(output))
	if strings.Contains(output, "Already up to date") || strings.Contains(output, "Already up-to-date") {
		return nil
	}

	return nil
}

func boundOutput(output string) string {
	if len(output) <= maxGitOutputChars {
		return output
	}
	return fmt.Sprintf("%s\n...[truncated %d chars]", output[:maxGitOutputChars], len(output)-maxGitOutputChars)
}

// Stash saves uncommitted changes to the stash stack.
func (s *Service) Stash(ctx context.Context, path string) error {
	if err := s.validateRepoPath(path); err != nil {
		return fmt.Errorf("git stash: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "stash", "push", "-m", "auto-stash before pull")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git stash timed out after 30s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		return fmt.Errorf("git stash failed: %w: %s", err, output)
	}

	logger.Debug("git stash: changes stashed successfully")
	return nil
}

// StashPop restores the most recent stashed changes.
func (s *Service) StashPop(ctx context.Context, path string) error {
	if err := s.validateRepoPath(path); err != nil {
		return fmt.Errorf("git stash pop: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "stash", "pop")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git stash pop timed out after 30s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		// "No stash entries found" is not an error condition
		if strings.Contains(output, "No stash entries found") {
			return nil
		}
		return fmt.Errorf("git stash pop failed: %w: %s", err, output)
	}

	logger.Debug("git stash pop: changes restored successfully")
	return nil
}

// PullWithStash performs a pull operation, automatically stashing and restoring
// uncommitted changes if necessary.
func (s *Service) PullWithStash(ctx context.Context, path, remote, branch string) error {
	status, err := s.GetStatus(ctx, path)
	if err != nil {
		return fmt.Errorf("checking status before pull: %w", err)
	}

	needsStash := !status.Clean
	if needsStash {
		logger.Debug("git pull: stashing uncommitted changes before pull")
		if err := s.Stash(ctx, path); err != nil {
			return fmt.Errorf("stashing changes before pull: %w", err)
		}
	}

	pullErr := s.Pull(ctx, path, remote, branch)

	if needsStash {
		logger.Debug("git pull: restoring stashed changes after pull")
		if err := s.StashPop(ctx, path); err != nil {
			if pullErr == nil {
				return fmt.Errorf("pull succeeded but failed to restore stashed changes: %w", err)
			}
			logger.WithError(err).Warn("failed to restore stashed changes after failed pull")
		}
	}

	return pullErr
}

// AheadBehind represents the commit difference between local and remote branches.
type AheadBehind struct {
	Ahead  int
	Behind int
}

// GetAheadBehind returns the number of commits the local branch is ahead/behind
// the remote tracking branch.
func (s *Service) GetAheadBehind(ctx context.Context, path, branch string) (*AheadBehind, error) {
	if err := s.validateRepoPath(path); err != nil {
		return nil, fmt.Errorf("git rev-list: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	refSpec := fmt.Sprintf("%s...origin/%s", branch, branch)
	cmd := s.newGitCmd(ctx, path, "rev-list", "--left-right", "--count", refSpec)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "unknown revision") {
			return &AheadBehind{Ahead: 0, Behind: 0}, nil
		}
		return nil, fmt.Errorf("git rev-list failed: %w: %s", err, stderrStr)
	}

	output := strings.TrimSpace(stdout.String())
	parts := strings.Split(output, "\t")
	if len(parts) != 2 {
		return nil, fmt.Errorf("unexpected rev-list output: %s", output)
	}

	var ahead, behind int
	if _, err := fmt.Sscanf(parts[0], "%d", &ahead); err != nil {
		return nil, fmt.Errorf("parsing ahead count: %w", err)
	}
	if _, err := fmt.Sscanf(parts[1], "%d", &behind); err != nil {
		return nil, fmt.Errorf("parsing behind count: %w", err)
	}

	return &AheadBehind{Ahead: ahead, Behind: behind}, nil
}

// RetryConfig configures retry behavior for network operations.
type RetryConfig struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
}

// DefaultRetryConfig returns sensible defaults for retry configuration.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:     3,
		InitialBackoff: 1 * time.Second,
		MaxBackoff:     30 * time.Second,
	}
}

// PushWithRetry attempts to push with exponential backoff on failure.
func (s *Service) PushWithRetry(ctx context.Context, path, remote, branch string, cfg RetryConfig) error {
	return s.retryOperation(ctx, cfg, "push", func() error {
		return s.Push(ctx, path, remote, branch)
	})
}

// FetchWithRetry attempts to fetch with exponential backoff on failure.
func (s *Service) FetchWithRetry(ctx context.Context, path, remote string, cfg RetryConfig) error {
	return s.retryOperation(ctx, cfg, "fetch", func() error {
		return s.Fetch(ctx, path, remote)
	})
}

// PullWithRetry attempts to pull with exponential backoff on failure.
func (s *Service) PullWithRetry(ctx context.Context, path, remote, branch string, cfg RetryConfig) error {
	return s.retryOperation(ctx, cfg, "pull", func() error {
		return s.Pull(ctx, path, remote, branch)
	})
}

// retryOperation executes an operation with exponential backoff.
func (s *Service) retryOperation(ctx context.Context, cfg RetryConfig, opName string, op func() error) error {
	var lastErr error
	backoff := cfg.InitialBackoff

	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		if err := op(); err != nil {
			lastErr = err

			if ctx.Err() != nil {
				return ctx.Err()
			}

			if attempt == cfg.MaxRetries {
				break
			}

			logger.WithFields(map[string]any{
				"operation": opName,
				"attempt":   attempt + 1,
				"backoff":   backoff,
				"error":     err,
			}).Warn("git operation failed, retrying")

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
				if backoff > cfg.MaxBackoff {
					backoff = cfg.MaxBackoff
				}
			}
			continue
		}
		return nil
	}

	return fmt.Errorf("%s failed after %d retries: %w", opName, cfg.MaxRetries+1, lastErr)
}

func (s *Service) GetStatus(ctx context.Context, path string) (*Status, error) {
	s.ensureLFConfig(ctx, path)

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "status", "--porcelain")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("git status timed out after 5s")
		}
		return nil, fmt.Errorf("git status failed: %w: %s", err, stderr.String())
	}

	status := &Status{
		Clean:      true,
		Modified:   []string{},
		Untracked:  []string{},
		Staged:     []string{},
		Deleted:    []string{},
		Renamed:    []string{},
		Conflicted: []string{},
	}

	lines := strings.Split(stdout.String(), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		status.Clean = false

		if len(line) < 3 {
			continue
		}

		indexStatus := line[0]
		workTreeStatus := line[1]
		filename := strings.TrimSpace(line[3:])

		if indexStatus == 'R' || indexStatus == 'C' {
			if idx := strings.Index(filename, " -> "); idx != -1 {
				filename = filename[idx+4:]
			}
			status.Renamed = append(status.Renamed, filename)
			status.Staged = append(status.Staged, filename)
			continue
		}

		if indexStatus == 'U' || workTreeStatus == 'U' ||
			(indexStatus == 'A' && workTreeStatus == 'A') ||
			(indexStatus == 'D' && workTreeStatus == 'D') {
			status.Conflicted = append(status.Conflicted, filename)
			continue
		}

		if indexStatus == '?' && workTreeStatus == '?' {
			status.Untracked = append(status.Untracked, filename)
			continue
		}

		switch indexStatus {
		case 'M':
			status.Staged = append(status.Staged, filename)
		case 'A':
			status.Staged = append(status.Staged, filename)
		case 'D':
			status.Deleted = append(status.Deleted, filename)
			status.Staged = append(status.Staged, filename)
		}

		switch workTreeStatus {
		case 'M':
			status.Modified = append(status.Modified, filename)
		case 'D':
			if indexStatus != 'D' {
				status.Deleted = append(status.Deleted, filename)
			}
		}
	}

	return status, nil
}

func (s *Service) ensureLFConfig(ctx context.Context, path string) {
	cleanPath := filepath.Clean(path)
	if cleanPath == "" {
		return
	}

	if _, loaded := s.configuredRepos.LoadOrStore(cleanPath, struct{}{}); loaded {
		return
	}

	// Only touch config on an actual git repository. Otherwise `git config`
	// fails with "fatal: not in a git directory" which spams the log on
	// data-dir paths that haven't been initialized yet.
	if isRepo, err := s.IsRepository(cleanPath); err != nil || !isRepo {
		// Undo the LoadOrStore so we retry once the directory becomes a repo.
		s.configuredRepos.Delete(cleanPath)
		return
	}

	configs := [][2]string{
		{"core.autocrlf", "false"},
		{"core.eol", "lf"},
		{"core.safecrlf", "false"},
	}

	for _, cfg := range configs {
		if err := s.setGitConfig(ctx, cleanPath, cfg[0], cfg[1]); err != nil {
			logger.WithError(err).Warnf("failed to set git config %s", cfg[0])
		}
	}
}

func (s *Service) setGitConfig(ctx context.Context, path, key, value string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	const maxAttempts = 3
	var lastErr error
	var lastStderr string
	for attempt := 0; attempt < maxAttempts; attempt++ {
		cmd := s.newGitCmd(ctx, path, "config", key, value)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr

		err := cmd.Run()
		if err == nil {
			return nil
		}
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git config %s timed out", key)
		}
		lastErr = err
		lastStderr = strings.TrimSpace(stderr.String())
		// Another git process holds the config lock; back off and retry briefly.
		if strings.Contains(lastStderr, "could not lock config file") {
			select {
			case <-ctx.Done():
				return fmt.Errorf("git config %s cancelled while waiting for lock", key)
			case <-time.After(time.Duration(50*(attempt+1)) * time.Millisecond):
			}
			continue
		}
		break
	}
	return fmt.Errorf("git config %s failed: %w: %s", key, lastErr, lastStderr)
}
