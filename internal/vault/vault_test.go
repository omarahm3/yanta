package vault

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNew(t *testing.T) {
	// Create temp directory for testing
	tempDir := t.TempDir()
	t.Setenv("HOME", tempDir)

	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name:    "default path",
			config:  Config{},
			wantErr: false,
		},
		{
			name:    "custom path",
			config:  Config{RootPath: filepath.Join(tempDir, "custom-vault")},
			wantErr: false,
		},
		{
			name:    "relative path gets converted",
			config:  Config{RootPath: "relative/path"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v, err := New(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("New() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if v == nil && !tt.wantErr {
				t.Error("New() returned nil vault")
			}
			if v != nil && !filepath.IsAbs(v.RootPath()) {
				t.Errorf("Root path is not absolute: %s", v.RootPath())
			}
		})
	}
}

func TestValidateDocumentPath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{
			name:    "valid path",
			path:    "projects/@yanta/doc-abc123.json",
			wantErr: false,
		},
		{
			name:    "directory traversal",
			path:    "projects/../etc/passwd",
			wantErr: true,
		},
		{
			name:    "missing projects prefix",
			path:    "yanta/doc-abc123.json",
			wantErr: true,
		},
		{
			name:    "missing .json extension",
			path:    "projects/@yanta/doc-abc123",
			wantErr: true,
		},
		{
			name:    "empty path",
			path:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateDocumentPath(tt.path)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDocumentPath() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestVault_EnsureProjectDir(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	projectAlias := "@test-project"

	// Ensure directory
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("EnsureProjectDir() failed: %v", err)
	}

	// Check project directory exists
	projectPath := v.ProjectPath(projectAlias)
	if _, err := os.Stat(projectPath); os.IsNotExist(err) {
		t.Errorf("Project directory was not created: %s", projectPath)
	}

	// Check assets directory exists
	assetsPath := v.AssetsPath(projectAlias)
	if _, err := os.Stat(assetsPath); os.IsNotExist(err) {
		t.Errorf("Assets directory was not created: %s", assetsPath)
	}

	// Calling again should not error (idempotent)
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Errorf("EnsureProjectDir() failed on second call: %v", err)
	}
}

func TestVault_RenameProject(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	oldAlias := "@old-project"
	newAlias := "@new-project"

	// Create old project
	if err := v.EnsureProjectDir(oldAlias); err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Create a test file
	testFile := filepath.Join(v.ProjectPath(oldAlias), "test.json")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Rename
	if err := v.RenameProject(oldAlias, newAlias); err != nil {
		t.Fatalf("RenameProject() failed: %v", err)
	}

	// Check old doesn't exist
	exists, _ := v.ProjectExists(oldAlias)
	if exists {
		t.Error("Old project directory still exists")
	}

	// Check new exists
	exists, err = v.ProjectExists(newAlias)
	if err != nil {
		t.Fatalf("Failed to check new project: %v", err)
	}
	if !exists {
		t.Error("New project directory does not exist")
	}

	// Check file was moved
	newTestFile := filepath.Join(v.ProjectPath(newAlias), "test.json")
	if _, err := os.Stat(newTestFile); os.IsNotExist(err) {
		t.Error("Test file was not moved to new location")
	}
}

func TestValidateProjectAlias(t *testing.T) {
	tests := []struct {
		name    string
		alias   string
		wantErr bool
	}{
		{
			name:    "valid alias",
			alias:   "@yanta",
			wantErr: false,
		},
		{
			name:    "valid with hyphens",
			alias:   "@laser-train",
			wantErr: false,
		},
		{
			name:    "missing at prefix",
			alias:   "yanta",
			wantErr: true,
		},
		{
			name:    "empty alias",
			alias:   "",
			wantErr: true,
		},
		{
			name:    "dot",
			alias:   ".",
			wantErr: true,
		},
		{
			name:    "dot dot",
			alias:   "..",
			wantErr: true,
		},
		{
			name:    "forward slash",
			alias:   "foo/bar",
			wantErr: true,
		},
		{
			name:    "backslash",
			alias:   "foo\\bar",
			wantErr: true,
		},
		{
			name:    "invalid character colon",
			alias:   "foo:bar",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateProjectAlias(tt.alias)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateProjectAlias() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGenerateDocumentPath(t *testing.T) {
	tests := []struct {
		name         string
		projectAlias string
		documentID   string
		want         string
		wantErr      bool
	}{
		{
			name:         "valid path",
			projectAlias: "@yanta",
			documentID:   "abc123",
			want:         "projects/@yanta/doc-yanta-abc123.json",
			wantErr:      false,
		},
		{
			name:         "invalid project alias",
			projectAlias: "foo/bar",
			documentID:   "abc123",
			want:         "",
			wantErr:      true,
		},
		{
			name:         "empty document ID",
			projectAlias: "@yanta",
			documentID:   "",
			want:         "",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GenerateDocumentPath(tt.projectAlias, tt.documentID)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateDocumentPath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("GenerateDocumentPath() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSanitizeProjectAlias(t *testing.T) {
	tests := []struct {
		name  string
		alias string
		want  string
	}{
		{
			name:  "already clean",
			alias: "@yanta",
			want:  "@yanta",
		},
		{
			name:  "uppercase to lowercase",
			alias: "YANTA",
			want:  "@yanta",
		},
		{
			name:  "add missing at prefix",
			alias: "yanta",
			want:  "@yanta",
		},
		{
			name:  "forward slash replaced",
			alias: "foo/bar",
			want:  "@foo-bar",
		},
		{
			name:  "multiple unsafe chars",
			alias: "foo<bar>baz",
			want:  "@foo-bar-baz",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeProjectAlias(tt.alias)
			if got != tt.want {
				t.Errorf("SanitizeProjectAlias() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVault_DocumentPath(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	tests := []struct {
		name         string
		relativePath string
		wantErr      bool
	}{
		{
			name:         "valid path",
			relativePath: "projects/@yanta/doc-abc123.json",
			wantErr:      false,
		},
		{
			name:         "invalid path",
			relativePath: "invalid/path.json",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := v.DocumentPath(tt.relativePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("DocumentPath() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !filepath.IsAbs(got) {
				t.Errorf("DocumentPath() returned relative path: %s", got)
			}
		})
	}
}

func TestVault_RelativePath(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	// Test valid path
	absPath := filepath.Join(tempDir, "projects", "@yanta", "doc-abc123.json")
	rel, err := v.RelativePath(absPath)
	if err != nil {
		t.Errorf("RelativePath() failed: %v", err)
	}
	expected := filepath.Join("projects", "@yanta", "doc-abc123.json")
	if rel != expected {
		t.Errorf("RelativePath() = %v, want %v", rel, expected)
	}

	// Test path that escapes vault
	escapeAbsPath := filepath.Join(filepath.Dir(tempDir), "outside.json")
	_, err = v.RelativePath(escapeAbsPath)
	if err == nil {
		t.Error("RelativePath() should error for path outside vault")
	}
}

func TestVault_ListProjects(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	// Initially empty
	projects, err := v.ListProjects()
	if err != nil {
		t.Fatalf("ListProjects() failed: %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("ListProjects() = %v, want empty", projects)
	}

	// Create some projects
	if err := v.EnsureProjectDir("@project-a"); err != nil {
		t.Fatalf("Failed to create project-a: %v", err)
	}
	if err := v.EnsureProjectDir("@project-b"); err != nil {
		t.Fatalf("Failed to create project-b: %v", err)
	}

	// List again
	projects, err = v.ListProjects()
	if err != nil {
		t.Fatalf("ListProjects() failed: %v", err)
	}
	if len(projects) != 2 {
		t.Errorf("ListProjects() returned %d projects, want 2", len(projects))
	}
}

func TestVault_DeleteProjectDir(t *testing.T) {
	tempDir := t.TempDir()
	v, err := New(Config{RootPath: tempDir})
	if err != nil {
		t.Fatalf("Failed to create vault: %v", err)
	}

	projectAlias := "@test-project"

	// Create project
	if err := v.EnsureProjectDir(projectAlias); err != nil {
		t.Fatalf("Failed to create project: %v", err)
	}

	// Verify exists
	exists, err := v.ProjectExists(projectAlias)
	if err != nil {
		t.Fatalf("Failed to check project: %v", err)
	}
	if !exists {
		t.Error("Project should exist before deletion")
	}

	// Delete
	if err := v.DeleteProjectDir(projectAlias); err != nil {
		t.Fatalf("DeleteProjectDir() failed: %v", err)
	}

	// Verify doesn't exist
	exists, err = v.ProjectExists(projectAlias)
	if err != nil {
		t.Fatalf("Failed to check project: %v", err)
	}
	if exists {
		t.Error("Project should not exist after deletion")
	}

	// Delete non-existent should error
	err = v.DeleteProjectDir(projectAlias)
	if err == nil {
		t.Error("DeleteProjectDir() should error for non-existent project")
	}
}
