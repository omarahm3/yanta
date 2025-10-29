package git

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Service struct{}

func NewService() *Service {
	return &Service{}
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
		return false, fmt.Errorf("git not found in PATH: %w", err)
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
	cmd := exec.Command("git", "init")
	cmd.Dir = path
	hideConsoleWindow(cmd)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git init failed: %w: %s", err, stderr.String())
	}

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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "add", "-A")
	cmd.Dir = path
	hideConsoleWindow(cmd)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git add timed out after 10s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		return fmt.Errorf("git add failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	return nil
}

func (s *Service) Commit(path, message string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "commit", "-m", message)
	cmd.Dir = path
	hideConsoleWindow(cmd)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("git commit timed out after 10s")
		}
		output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if strings.Contains(output, "nothing to commit") || strings.Contains(output, "nothing added to commit") {
			return fmt.Errorf("nothing to commit")
		}
		return fmt.Errorf("git commit failed (exit status %d):\n%s", cmd.ProcessState.ExitCode(), output)
	}

	return nil
}

func (s *Service) SetRemote(path, name, url string) error {
	cmd := exec.Command("git", "remote", "add", name, url)
	cmd.Dir = path
	hideConsoleWindow(cmd)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := stderr.String()
		if strings.Contains(errMsg, "already exists") {
			cmd = exec.Command("git", "remote", "set-url", name, url)
			cmd.Dir = path
			hideConsoleWindow(cmd)
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
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "push", remote, branch)
	cmd.Dir = path
	hideConsoleWindow(cmd)

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

	return nil
}

func (s *Service) GetStatus(path string) (*Status, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "status", "--porcelain")
	cmd.Dir = path
	hideConsoleWindow(cmd)

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
		case "M ", " M", "MM":
			status.Modified = append(status.Modified, filename)
		case "A ", "AM":
			status.Staged = append(status.Staged, filename)
		}
	}

	return status, nil
}
