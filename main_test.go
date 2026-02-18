package main

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"

	"yanta/internal/testenv"
)

func TestBuildSingleInstanceID(t *testing.T) {
	tempDir := t.TempDir()
	cleanup := testenv.SetTestHome(t, tempDir)
	defer cleanup()

	t.Run("stable for same root", func(t *testing.T) {
		appRoot := filepath.Join(tempDir, "isolated-home")
		cleanupRoot := testenv.SetTestAppHome(t, appRoot)
		defer cleanupRoot()

		id1 := buildSingleInstanceID()
		id2 := buildSingleInstanceID()
		assert.Equal(t, id1, id2)
		assert.Contains(t, id1, "com.yanta.app.")
	})

	t.Run("different roots produce different IDs", func(t *testing.T) {
		cleanupRootA := testenv.SetTestAppHome(t, filepath.Join(tempDir, "home-a"))
		idA := buildSingleInstanceID()
		cleanupRootA()

		cleanupRootB := testenv.SetTestAppHome(t, filepath.Join(tempDir, "home-b"))
		idB := buildSingleInstanceID()
		cleanupRootB()

		assert.NotEqual(t, idA, idB)
	})
}
