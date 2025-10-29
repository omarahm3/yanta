package system

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"yanta/internal/git"

	"github.com/stretchr/testify/assert"
)

func TestSetShutdownHandler(t *testing.T) {
	t.Run("sets shutdown handler successfully", func(t *testing.T) {
		service := NewService(nil)

		called := false
		handler := func(ctx context.Context) {
			called = true
		}

		service.SetShutdownHandler(handler)
		assert.NotNil(t, service.shutdownHandler)

		service.shutdownHandler(context.Background())
		assert.True(t, called, "shutdown handler should have been called")
	})

	t.Run("shutdown handler can be updated", func(t *testing.T) {
		service := NewService(nil)

		firstCallCount := 0
		firstHandler := func(ctx context.Context) {
			firstCallCount++
		}

		secondCallCount := 0
		secondHandler := func(ctx context.Context) {
			secondCallCount++
		}

		service.SetShutdownHandler(firstHandler)
		service.shutdownHandler(context.Background())
		assert.Equal(t, 1, firstCallCount)

		service.SetShutdownHandler(secondHandler)
		service.shutdownHandler(context.Background())
		assert.Equal(t, 1, firstCallCount, "first handler should not be called again")
		assert.Equal(t, 1, secondCallCount, "second handler should be called")
	})

	t.Run("nil shutdown handler is safe", func(t *testing.T) {
		service := NewService(nil)
		assert.Nil(t, service.shutdownHandler)

		assert.NotPanics(t, func() {
			if service.shutdownHandler != nil {
				service.shutdownHandler(context.Background())
			}
		})
	})
}

func TestMigrateToGitDirectory_ShutdownHandler(t *testing.T) {
	t.Run("shutdown handler is called when set", func(t *testing.T) {
		service := NewService(nil)

		shutdownCalled := false
		var shutdownCtx context.Context

		service.SetShutdownHandler(func(ctx context.Context) {
			shutdownCalled = true
			shutdownCtx = ctx
		})

		assert.NotNil(t, service.shutdownHandler)

		service.shutdownHandler(context.Background())

		assert.True(t, shutdownCalled)
		assert.NotNil(t, shutdownCtx)
	})

	t.Run("nil shutdown handler does not cause panic", func(t *testing.T) {
		service := NewService(nil)

		assert.Nil(t, service.shutdownHandler)

		assert.NotPanics(t, func() {
			if service.shutdownHandler != nil {
				service.shutdownHandler(context.Background())
			}
		})
	})
}

type mockGitService struct{}

func (m *mockGitService) CheckInstalled() (bool, error) {
	return true, nil
}

func (m *mockGitService) IsRepository(path string) (bool, error) {
	return false, nil
}

func (m *mockGitService) Init(path string) error {
	gitDir := filepath.Join(path, ".git")
	return os.MkdirAll(gitDir, 0755)
}

func (m *mockGitService) CreateGitIgnore(path string, patterns []string) error {
	gitignorePath := filepath.Join(path, ".gitignore")
	content := ""
	for _, pattern := range patterns {
		content += pattern + "\n"
	}
	return os.WriteFile(gitignorePath, []byte(content), 0644)
}

func (m *mockGitService) AddAll(path string) error {
	return nil
}

func (m *mockGitService) Commit(path, message string) error {
	return nil
}

func (m *mockGitService) SetRemote(path, name, url string) error {
	return nil
}

func (m *mockGitService) Push(path, remote, branch string) error {
	return nil
}

func (m *mockGitService) GetStatus(path string) (*git.Status, error) {
	return &git.Status{
		Clean:     true,
		Modified:  []string{},
		Untracked: []string{},
		Staged:    []string{},
	}, nil
}
