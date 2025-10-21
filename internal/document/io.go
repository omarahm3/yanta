package document

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"yanta/internal/logger"
	"yanta/internal/project"
	"yanta/internal/vault"
)

type FileReader struct {
	vault *vault.Vault
}

func NewFileReader(v *vault.Vault) *FileReader {
	return &FileReader{vault: v}
}

func (r *FileReader) ReadFile(relativePath string) (*DocumentFile, error) {
	logger.WithField("relativePath", relativePath).Debug("FileReader.ReadFile called")

	absPath, err := r.vault.DocumentPath(relativePath)
	if err != nil {
		logger.WithError(err).WithField("relativePath", relativePath).Error("failed to resolve document path")
		return nil, wrapIOError("read", relativePath, fmt.Errorf("%w: %v", ErrInvalidPath, err))
	}
	logger.WithFields(map[string]any{
		"relativePath": relativePath,
		"absPath":      absPath,
	}).Debug("document path resolved")

	logger.WithField("absPath", absPath).Debug("reading file from disk")
	data, err := os.ReadFile(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			logger.WithField("absPath", absPath).Warn("document file not found")
			return nil, wrapIOError("read", relativePath, ErrNotFound)
		}
		logger.WithError(err).WithField("absPath", absPath).Error("failed to read document file from disk")
		return nil, wrapIOError("read", relativePath, err)
	}
	logger.WithFields(map[string]any{
		"absPath":  absPath,
		"fileSize": len(data),
	}).Debug("file read from disk successfully")

	logger.WithField("relativePath", relativePath).Debug("parsing JSON")
	doc, err := FromJSON(data)
	if err != nil {
		logger.WithError(err).WithField("relativePath", relativePath).Error("failed to parse document JSON")
		return nil, wrapIOError("read", relativePath, fmt.Errorf("%w: %v", ErrCorrupted, err))
	}

	logger.WithFields(map[string]any{
		"relativePath": relativePath,
		"title":        doc.Meta.Title,
		"blocksCount":  len(doc.Blocks),
	}).Debug("document parsed successfully")

	return doc, nil
}

func (r *FileReader) FileExists(relativePath string) (bool, error) {
	absPath, err := r.vault.DocumentPath(relativePath)
	if err != nil {
		return false, wrapIOError("stat", relativePath, fmt.Errorf("%w: %v", ErrInvalidPath, err))
	}

	_, err = os.Stat(absPath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, wrapIOError("stat", relativePath, err)
}

type FileWriter struct {
	vault *vault.Vault
}

func NewFileWriter(v *vault.Vault) *FileWriter {
	return &FileWriter{vault: v}
}

func (w *FileWriter) WriteFile(relativePath string, doc *DocumentFile) error {
	if err := doc.Validate(); err != nil {
		return wrapIOError("write", relativePath, fmt.Errorf("%w: %v", ErrValidation, err))
	}

	absPath, err := w.vault.DocumentPath(relativePath)
	if err != nil {
		return wrapIOError("write", relativePath, fmt.Errorf("%w: %v", ErrInvalidPath, err))
	}

	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return wrapIOError("write", relativePath, fmt.Errorf("creating directory: %w", err))
	}

	jsonData, err := doc.ToJSON()
	if err != nil {
		return wrapIOError("write", relativePath, fmt.Errorf("serializing: %w", err))
	}

	if err := writeFileAtomic(absPath, jsonData); err != nil {
		return wrapIOError("write", relativePath, fmt.Errorf("%w: %v", ErrWriteFailed, err))
	}

	return nil
}

func (w *FileWriter) UpdateFile(relativePath string, updateFn func(*DocumentFile) error) error {
	reader := NewFileReader(w.vault)
	doc, err := reader.ReadFile(relativePath)
	if err != nil {
		return err
	}

	if err := updateFn(doc); err != nil {
		return wrapIOError("update", relativePath, fmt.Errorf("update function failed: %w", err))
	}

	doc.UpdateTimestamp()

	return w.WriteFile(relativePath, doc)
}

func (w *FileWriter) DeleteFile(relativePath string) error {
	absPath, err := w.vault.DocumentPath(relativePath)
	if err != nil {
		return wrapIOError("delete", relativePath, fmt.Errorf("%w: %v", ErrInvalidPath, err))
	}

	_, err = os.Stat(absPath)
	if os.IsNotExist(err) {
		return wrapIOError("delete", relativePath, ErrNotFound)
	}
	if err != nil {
		return wrapIOError("delete", relativePath, err)
	}

	if err := os.Remove(absPath); err != nil {
		return wrapIOError("delete", relativePath, err)
	}

	return nil
}

type FileLister struct {
	vault *vault.Vault
}

func NewFileLister(v *vault.Vault) *FileLister {
	return &FileLister{vault: v}
}

func (l *FileLister) ListFiles(projectAlias string) ([]string, error) {
	if err := project.ValidateAlias(projectAlias); err != nil {
		return nil, fmt.Errorf("invalid project alias: %w", err)
	}

	projectDir := l.vault.ProjectPath(projectAlias)

	exists, err := l.vault.ProjectExists(projectAlias)
	if err != nil {
		return nil, fmt.Errorf("checking project: %w", err)
	}
	if !exists {
		return []string{}, nil
	}

	entries, err := os.ReadDir(projectDir)
	if err != nil {
		return nil, fmt.Errorf("reading project directory: %w", err)
	}

	var paths []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if strings.HasPrefix(name, "doc-") && strings.HasSuffix(name, ".json") {
			relativePath := path.Join("projects", projectAlias, name)
			paths = append(paths, relativePath)
		}
	}

	return paths, nil
}

func (l *FileLister) ListFilesRecursive() ([]string, error) {
	projects, err := l.vault.ListProjects()
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}

	var allPaths []string
	for _, project := range projects {
		paths, err := l.ListFiles(project)
		if err != nil {
			return nil, fmt.Errorf("listing files for project %s: %w", project, err)
		}
		allPaths = append(allPaths, paths...)
	}

	return allPaths, nil
}

func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmpFile, err := os.CreateTemp(dir, ".tmp-doc-*.json")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}

	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return fmt.Errorf("writing temp file: %w", err)
	}

	if err := tmpFile.Sync(); err != nil {
		tmpFile.Close()
		return fmt.Errorf("syncing temp file: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("closing temp file: %w", err)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("renaming temp file: %w", err)
	}

	return nil
}

type FileManager struct {
	*FileReader
	*FileWriter
	*FileLister
}

func NewFileManager(v *vault.Vault) *FileManager {
	return &FileManager{
		FileReader: NewFileReader(v),
		FileWriter: NewFileWriter(v),
		FileLister: NewFileLister(v),
	}
}
