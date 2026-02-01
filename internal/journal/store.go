package journal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"yanta/internal/vault"
)

// Store handles file I/O for journal files.
type Store struct {
	vault *vault.Vault
}

// NewStore creates a new journal store.
func NewStore(v *vault.Vault) *Store {
	return &Store{vault: v}
}

// GetJournalPath returns the relative path for a journal file.
// Format: projects/{projectAlias}/journal/{date}.json
func (s *Store) GetJournalPath(projectAlias, date string) string {
	return filepath.ToSlash(filepath.Join("projects", projectAlias, "journal", date+".json"))
}

// GetAbsolutePath returns the absolute path for a journal file.
func (s *Store) GetAbsolutePath(projectAlias, date string) string {
	relPath := s.GetJournalPath(projectAlias, date)
	return filepath.Join(s.vault.RootPath(), filepath.FromSlash(relPath))
}

// GetJournalDir returns the absolute path to a project's journal directory.
func (s *Store) GetJournalDir(projectAlias string) string {
	return filepath.Join(s.vault.RootPath(), "projects", projectAlias, "journal")
}

// Exists checks if a journal file exists.
func (s *Store) Exists(projectAlias, date string) bool {
	absPath := s.GetAbsolutePath(projectAlias, date)
	_, err := os.Stat(absPath)
	return err == nil
}

// ReadFile reads a journal file. If the file doesn't exist, returns a new empty journal.
func (s *Store) ReadFile(projectAlias, date string) (*JournalFile, error) {
	absPath := s.GetAbsolutePath(projectAlias, date)

	data, err := os.ReadFile(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty journal for non-existent file
			return NewJournalFile(projectAlias, date), nil
		}
		return nil, fmt.Errorf("reading journal file: %w", err)
	}

	var file JournalFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("unmarshal journal file: %w", err)
	}

	return &file, nil
}

// WriteFile writes a journal file to disk.
func (s *Store) WriteFile(projectAlias, date string, file *JournalFile) error {
	absPath := s.GetAbsolutePath(projectAlias, date)

	// Ensure directory exists
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("creating journal directory: %w", err)
	}

	// Marshal with indentation for readability
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal journal file: %w", err)
	}

	// Write atomically using temp file
	tmpPath := absPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("writing temp file: %w", err)
	}

	if err := os.Rename(tmpPath, absPath); err != nil {
		os.Remove(tmpPath) // Clean up temp file
		return fmt.Errorf("renaming temp file: %w", err)
	}

	return nil
}

// DeleteFile deletes a journal file from disk.
func (s *Store) DeleteFile(projectAlias, date string) error {
	absPath := s.GetAbsolutePath(projectAlias, date)

	if err := os.Remove(absPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("deleting journal file: %w", err)
	}

	return nil
}

// ListDates returns all journal dates for a project.
func (s *Store) ListDates(projectAlias string) ([]string, error) {
	journalDir := s.GetJournalDir(projectAlias)

	entries, err := os.ReadDir(journalDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("reading journal directory: %w", err)
	}

	var dates []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(name, ".json") {
			continue
		}

		// Extract date from filename (e.g., "2026-01-30.json" -> "2026-01-30")
		date := strings.TrimSuffix(name, ".json")

		// Validate it's a proper date format
		if ValidateDate(date) != nil {
			continue
		}

		dates = append(dates, date)
	}

	// Sort dates in descending order (newest first)
	sort.Sort(sort.Reverse(sort.StringSlice(dates)))

	return dates, nil
}

// ListDatesByYearMonth returns journal dates for a specific year and month.
func (s *Store) ListDatesByYearMonth(projectAlias string, year, month int) ([]string, error) {
	allDates, err := s.ListDates(projectAlias)
	if err != nil {
		return nil, err
	}

	prefix := fmt.Sprintf("%04d-%02d-", year, month)
	var filtered []string
	for _, date := range allDates {
		if strings.HasPrefix(date, prefix) {
			filtered = append(filtered, date)
		}
	}

	return filtered, nil
}

// UpdateFile reads a file, applies an update function, and writes it back.
func (s *Store) UpdateFile(projectAlias, date string, updateFn func(*JournalFile) error) error {
	file, err := s.ReadFile(projectAlias, date)
	if err != nil {
		return fmt.Errorf("reading file for update: %w", err)
	}

	if err := updateFn(file); err != nil {
		return fmt.Errorf("applying update: %w", err)
	}

	file.UpdateTimestamp()

	if err := s.WriteFile(projectAlias, date, file); err != nil {
		return fmt.Errorf("writing updated file: %w", err)
	}

	return nil
}
