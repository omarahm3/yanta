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

type Service struct{}

var configuredRepos sync.Map

func NewService() *Service {
	return &Service{}
}

func (s *Service) newGitCmd(ctx context.Context, dir string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	hideConsoleWindow(cmd)

	env := append([]string{}, os.Environ()...)
	env = append(env,
		"GIT_CONFIG_COUNT=2",
		"GIT_CONFIG_KEY_0=core.autocrlf",
		"GIT_CONFIG_VALUE_0=false",
		"GIT_CONFIG_KEY_1=core.safecrlf",
		"GIT_CONFIG_VALUE_1=false",
	)
	cmd.Env = env

	return cmd
}

type Status struct {
	Clean     bool
	Modified  []string
	Untracked []string
	Staged    []string
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

func (s *Service) Init(path string) error {
	cmd := s.newGitCmd(context.Background(), path, "init")

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git init failed: %w: %s", err, stderr.String())
	}

	s.ensureLFConfig(path)
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

func (s *Service) AddAll(path string) error {
	s.ensureLFConfig(path)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := s.newGitCmd(ctx, path, "add", "-A")

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git add timed out after 30s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		return fmt.Errorf("git add failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	logger.Debugf("git add output:\n%s\n%s", stdout.String(), stderr.String())
	return nil
}

func (s *Service) Commit(path, message string) error {
	s.ensureLFConfig(path)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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
			logger.Debugf("git commit output (error):\n%s", output)
		}
		if strings.Contains(output, "nothing to commit") || strings.Contains(output, "nothing added to commit") {
			return fmt.Errorf("nothing to commit")
		}
		return fmt.Errorf("git commit failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	logger.Debugf("git commit output:\n%s\n%s", stdout.String(), stderr.String())
	return nil
}

func (s *Service) SetRemote(path, name, url string) error {
	s.ensureLFConfig(path)

	cmd := s.newGitCmd(context.Background(), path, "remote", "add", name, url)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := stderr.String()
		if strings.Contains(errMsg, "already exists") {
			cmd = s.newGitCmd(context.Background(), path, "remote", "set-url", name, url)
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

func (s *Service) Push(path, remote, branch string) error {
	s.ensureLFConfig(path)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
		return fmt.Errorf("git push failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	logger.Debugf("git push output:\n%s\n%s", stdout.String(), stderr.String())
	return nil
}

func (s *Service) Pull(path, remote, branch string) error {
	s.ensureLFConfig(path)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
			return fmt.Errorf("MERGE_CONFLICT:\nMerge conflicts detected. Please resolve conflicts manually:\n\n%s\n\nSteps to resolve:\n1. Check conflicted files with 'git status'\n2. Edit files to resolve conflicts (look for <<<<<<<, =======, >>>>>>>)\n3. Stage resolved files with 'git add <file>'\n4. Commit with 'git commit'", output)
		}

		if strings.Contains(output, "divergent branches") || strings.Contains(output, "have diverged") {
			return fmt.Errorf("DIVERGED_BRANCHES:\nLocal and remote branches have diverged.\n\n%s\n\nYou need to:\n1. Review remote changes\n2. Either merge or rebase\n3. Then push your changes", output)
		}

		if strings.Contains(output, "refusing to merge unrelated histories") {
			return fmt.Errorf("UNRELATED_HISTORIES:\nRepositories have unrelated commit histories.\n\n%s\n\nUse 'git pull --allow-unrelated-histories' if you're sure you want to merge.", output)
		}

		return fmt.Errorf("git pull failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
	logger.Debugf("git pull output:\n%s", output)
	if strings.Contains(output, "Already up to date") || strings.Contains(output, "Already up-to-date") {
		return nil
	}

	return nil
}

func (s *Service) GetStatus(path string) (*Status, error) {
	s.ensureLFConfig(path)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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
		Clean:     true,
		Modified:  []string{},
		Untracked: []string{},
		Staged:    []string{},
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

		statusCode := line[0:2]
		filename := strings.TrimSpace(line[3:])

		switch statusCode {
		case "??":
			status.Untracked = append(status.Untracked, filename)
		case "M ":
			status.Staged = append(status.Staged, filename)
		case " M":
			status.Modified = append(status.Modified, filename)
		case "MM":
			status.Staged = append(status.Staged, filename)
			status.Modified = append(status.Modified, filename)
		case "A ", "AM":
			status.Staged = append(status.Staged, filename)
		}
	}

	return status, nil
}

func (s *Service) ensureLFConfig(path string) {
	cleanPath := filepath.Clean(path)
	if cleanPath == "" {
		return
	}

	if _, loaded := configuredRepos.LoadOrStore(cleanPath, struct{}{}); loaded {
		return
	}

	configs := [][2]string{
		{"core.autocrlf", "false"},
		{"core.eol", "lf"},
		{"core.safecrlf", "false"},
	}

	for _, cfg := range configs {
		if err := s.setGitConfig(cleanPath, cfg[0], cfg[1]); err != nil {
			logger.WithError(err).Warnf("failed to set git config %s", cfg[0])
		}
	}
}

func (s *Service) setGitConfig(path, key, value string) error {
	cmd := s.newGitCmd(context.Background(), path, "config", key, value)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git config %s failed: %w: %s", key, err, strings.TrimSpace(stderr.String()))
	}

	return nil
}
