package journal

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"yanta/internal/events"
	"yanta/internal/logger"
	"yanta/internal/vault"
)

// Indexer interface for indexing documents created by promote.
type Indexer interface {
	IndexDocument(ctx context.Context, docPath string) error
}

// Service provides journal operations.
type Service struct {
	vault    *vault.Vault
	store    *Store
	eventBus *events.EventBus
	indexer  Indexer
	mu       sync.Mutex // Serializes writes to prevent race conditions
}

// NewService creates a new journal service.
func NewService(v *vault.Vault, eventBus *events.EventBus) *Service {
	return &Service{
		vault:    v,
		store:    NewStore(v),
		eventBus: eventBus,
	}
}

// SetIndexer sets the document indexer for promoted documents.
func (s *Service) SetIndexer(indexer Indexer) {
	s.indexer = indexer
}

func (s *Service) emitEvent(eventName string, payload any) {
	if s.eventBus != nil {
		s.eventBus.Emit(eventName, payload)
	}
}

// AppendEntryRequest is the request for adding a new journal entry.
type AppendEntryRequest struct {
	ProjectAlias string   `json:"projectAlias"`
	Content      string   `json:"content"`
	Tags         []string `json:"tags"`
}

// AppendEntryRequestWithDate allows specifying a date for backdated entries.
type AppendEntryRequestWithDate struct {
	ProjectAlias string   `json:"projectAlias"`
	Content      string   `json:"content"`
	Tags         []string `json:"tags"`
	Date         string   `json:"date"`
}

// UpdateEntryRequest is the request for updating an existing entry.
type UpdateEntryRequest struct {
	ProjectAlias string   `json:"projectAlias"`
	Date         string   `json:"date"`
	EntryID      string   `json:"entryId"`
	Content      string   `json:"content"`
	Tags         []string `json:"tags"` // nil means keep existing
}

// PromoteRequest is the request for promoting entries to a document.
type PromoteRequest struct {
	SourceProject string   `json:"sourceProject"`
	Date          string   `json:"date"`
	EntryIDs      []string `json:"entryIds"` // empty means whole day
	TargetProject string   `json:"targetProject"`
	Title         string   `json:"title"`
	KeepOriginal  bool     `json:"keepOriginal"` // true = copy, false = move
}

// AppendEntry adds a quick note to today's journal for the given project.
func (s *Service) AppendEntry(ctx context.Context, req AppendEntryRequest) (*JournalEntry, error) {
	return s.AppendEntryToDate(ctx, AppendEntryRequestWithDate{
		ProjectAlias: req.ProjectAlias,
		Content:      req.Content,
		Tags:         req.Tags,
		Date:         TodayDate(),
	})
}

// AppendEntryToDate adds a quick note to a specific date's journal.
func (s *Service) AppendEntryToDate(ctx context.Context, req AppendEntryRequestWithDate) (*JournalEntry, error) {
	// Validate content
	if strings.TrimSpace(req.Content) == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}

	if len(req.Content) > MaxEntryContentLength {
		return nil, fmt.Errorf("content exceeds maximum length of %d characters", MaxEntryContentLength)
	}

	// Validate date if provided
	date := req.Date
	if date == "" {
		date = TodayDate()
	} else {
		if err := ValidateDate(date); err != nil {
			return nil, err
		}
	}

	// Normalize project alias
	projectAlias := strings.TrimSpace(req.ProjectAlias)
	if projectAlias == "" {
		return nil, fmt.Errorf("projectAlias is required")
	}

	// Create the entry
	entry := NewJournalEntry(req.Content, req.Tags)

	// Lock for write operation
	s.mu.Lock()
	defer s.mu.Unlock()

	// Read or create the journal file
	file, err := s.store.ReadFile(projectAlias, date)
	if err != nil {
		return nil, fmt.Errorf("reading journal file: %w", err)
	}

	// Append the entry
	file.AppendEntry(entry)

	// Write back
	if err := s.store.WriteFile(projectAlias, date, file); err != nil {
		return nil, fmt.Errorf("writing journal file: %w", err)
	}

	logger.WithFields(map[string]any{
		"project": projectAlias,
		"date":    date,
		"entryId": entry.ID,
	}).Info("journal entry appended")

	s.emitEvent(events.EntryCreated, map[string]any{
		"type":      "journal",
		"projectId": projectAlias,
		"date":      date,
		"entryId":   entry.ID,
	})

	return entry, nil
}

// GetToday returns today's journal for a project.
func (s *Service) GetToday(ctx context.Context, projectAlias string) (*JournalFile, error) {
	return s.GetByDate(ctx, projectAlias, TodayDate())
}

// GetByDate returns a specific day's journal.
func (s *Service) GetByDate(ctx context.Context, projectAlias, date string) (*JournalFile, error) {
	if err := ValidateDate(date); err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	file, err := s.store.ReadFile(projectAlias, date)
	if err != nil {
		return nil, fmt.Errorf("reading journal: %w", err)
	}

	return file, nil
}

// GetActiveEntries returns non-deleted entries for a date.
func (s *Service) GetActiveEntries(ctx context.Context, projectAlias, date string) ([]JournalEntry, error) {
	file, err := s.GetByDate(ctx, projectAlias, date)
	if err != nil {
		return nil, err
	}

	return file.ActiveEntries(), nil
}

// GetAllActiveEntries returns non-deleted entries from all projects for a date.
func (s *Service) GetAllActiveEntries(ctx context.Context, date string) ([]JournalEntryWithProject, error) {
	if err := ValidateDate(date); err != nil {
		return nil, fmt.Errorf("invalid date: %w", err)
	}

	projects, err := s.vault.ListProjects()
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}

	var allEntries []JournalEntryWithProject

	for _, projectAlias := range projects {
		file, err := s.store.ReadFile(projectAlias, date)
		if err != nil {
			// Skip projects with no journal for this date
			if os.IsNotExist(err) {
				continue
			}
			logger.Warnf("failed to read journal for %s on %s: %v", projectAlias, date, err)
			continue
		}

		for _, entry := range file.ActiveEntries() {
			allEntries = append(allEntries, JournalEntryWithProject{
				JournalEntry: entry,
				ProjectAlias: projectAlias,
			})
		}
	}

	return allEntries, nil
}

// ListAllDates returns available journal dates from all projects.
func (s *Service) ListAllDates(ctx context.Context) ([]string, error) {
	projects, err := s.vault.ListProjects()
	if err != nil {
		return nil, fmt.Errorf("listing projects: %w", err)
	}

	dateSet := make(map[string]struct{})

	for _, projectAlias := range projects {
		dates, err := s.store.ListDates(projectAlias)
		if err != nil {
			logger.Warnf("failed to list dates for %s: %v", projectAlias, err)
			continue
		}
		for _, d := range dates {
			dateSet[d] = struct{}{}
		}
	}

	dates := make([]string, 0, len(dateSet))
	for d := range dateSet {
		dates = append(dates, d)
	}

	return dates, nil
}

// ListDates returns available journal dates for a project.
// If year and month are both 0, returns all dates.
func (s *Service) ListDates(ctx context.Context, projectAlias string, year, month int) ([]string, error) {
	if year > 0 && month > 0 {
		return s.store.ListDatesByYearMonth(projectAlias, year, month)
	}

	return s.store.ListDates(projectAlias)
}

// DeleteEntry soft-deletes an entry (sets deleted: true).
func (s *Service) DeleteEntry(ctx context.Context, projectAlias, date, entryID string) error {
	if err := ValidateDate(date); err != nil {
		return fmt.Errorf("invalid date: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := s.store.ReadFile(projectAlias, date)
	if err != nil {
		return fmt.Errorf("reading journal: %w", err)
	}

	entry := file.GetEntry(entryID)
	if entry == nil {
		return fmt.Errorf("entry not found: %s", entryID)
	}

	entry.MarkDeleted()
	file.UpdateTimestamp()

	if err := s.store.WriteFile(projectAlias, date, file); err != nil {
		return fmt.Errorf("writing journal: %w", err)
	}

	logger.WithFields(map[string]any{
		"project": projectAlias,
		"date":    date,
		"entryId": entryID,
	}).Info("journal entry deleted")

	s.emitEvent(events.EntryDeleted, map[string]any{
		"type":      "journal",
		"projectId": projectAlias,
		"date":      date,
		"entryId":   entryID,
	})

	return nil
}

// UpdateEntry edits an existing entry.
func (s *Service) UpdateEntry(ctx context.Context, req UpdateEntryRequest) (*JournalEntry, error) {
	if err := ValidateDate(req.Date); err != nil {
		return nil, fmt.Errorf("invalid date: %w", err)
	}

	if strings.TrimSpace(req.Content) == "" {
		return nil, fmt.Errorf("content cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := s.store.ReadFile(req.ProjectAlias, req.Date)
	if err != nil {
		return nil, fmt.Errorf("reading journal: %w", err)
	}

	entry := file.GetEntry(req.EntryID)
	if entry == nil {
		return nil, fmt.Errorf("entry not found: %s", req.EntryID)
	}

	// Update content
	entry.Content = req.Content

	// Update tags only if provided (nil means keep existing)
	if req.Tags != nil {
		entry.Tags = req.Tags
	}

	file.UpdateTimestamp()

	if err := s.store.WriteFile(req.ProjectAlias, req.Date, file); err != nil {
		return nil, fmt.Errorf("writing journal: %w", err)
	}

	logger.WithFields(map[string]any{
		"project": req.ProjectAlias,
		"date":    req.Date,
		"entryId": req.EntryID,
	}).Info("journal entry updated")

	s.emitEvent(events.EntryUpdated, map[string]any{
		"type":      "journal",
		"projectId": req.ProjectAlias,
		"date":      req.Date,
		"entryId":   req.EntryID,
	})

	return entry, nil
}

// PromoteToDocument converts journal entries to a full document.
func (s *Service) PromoteToDocument(ctx context.Context, req PromoteRequest) (string, error) {
	if err := ValidateDate(req.Date); err != nil {
		return "", fmt.Errorf("invalid date: %w", err)
	}

	if req.Title == "" {
		return "", fmt.Errorf("title is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := s.store.ReadFile(req.SourceProject, req.Date)
	if err != nil {
		return "", fmt.Errorf("reading journal: %w", err)
	}

	// Determine which entries to promote
	var entriesToPromote []*JournalEntry
	if len(req.EntryIDs) == 0 {
		// Promote all active entries
		for i := range file.Entries {
			if !file.Entries[i].Deleted {
				entriesToPromote = append(entriesToPromote, &file.Entries[i])
			}
		}
	} else {
		// Promote specific entries
		for _, id := range req.EntryIDs {
			entry := file.GetEntry(id)
			if entry == nil {
				return "", fmt.Errorf("entry not found: %s", id)
			}
			entriesToPromote = append(entriesToPromote, entry)
		}
	}

	if len(entriesToPromote) == 0 {
		return "", fmt.Errorf("no entries to promote")
	}

	// Build document content
	var contentBuilder strings.Builder
	var allTags []string
	tagMap := make(map[string]bool)

	for i, entry := range entriesToPromote {
		if i > 0 {
			contentBuilder.WriteString("\n\n")
		}
		contentBuilder.WriteString(entry.Content)

		// Collect tags
		for _, tag := range entry.Tags {
			if !tagMap[tag] {
				tagMap[tag] = true
				allTags = append(allTags, tag)
			}
		}
	}

	// Create the document file
	docID := strings.ReplaceAll(uuid.New().String(), "-", "")[:12]
	aliasSlug := strings.TrimPrefix(req.TargetProject, "@")
	filename := fmt.Sprintf("doc-%s-%s.json", aliasSlug, docID)
	docPath := filepath.Join("projects", req.TargetProject, filename)

	// Build document structure (matching DocumentFile from document package)
	docFile := map[string]any{
		"meta": map[string]any{
			"project": req.TargetProject,
			"title":   req.Title,
			"tags":    allTags,
			"aliases": []string{},
			"created": time.Now().Format(time.RFC3339),
			"updated": time.Now().Format(time.RFC3339),
		},
		"blocks": []map[string]any{
			{
				"id":   strings.ReplaceAll(uuid.New().String(), "-", "")[:8],
				"type": "paragraph",
				"props": map[string]any{
					"textColor":       "default",
					"backgroundColor": "default",
					"textAlignment":   "left",
				},
				"content": []map[string]any{
					{
						"type":   "text",
						"text":   contentBuilder.String(),
						"styles": map[string]any{},
					},
				},
				"children": []any{},
			},
		},
	}

	docData, err := json.MarshalIndent(docFile, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshaling document: %w", err)
	}

	// Write document file
	absDocPath := filepath.Join(s.vault.RootPath(), docPath)
	if err := os.MkdirAll(filepath.Dir(absDocPath), 0755); err != nil {
		return "", fmt.Errorf("creating document directory: %w", err)
	}

	if err := os.WriteFile(absDocPath, docData, 0644); err != nil {
		return "", fmt.Errorf("writing document: %w", err)
	}

	// Index the document so it appears in the database
	if s.indexer != nil {
		if err := s.indexer.IndexDocument(ctx, docPath); err != nil {
			logger.WithError(err).WithField("docPath", docPath).Error("failed to index promoted document")
			// Don't fail the operation, the document was created successfully
		}
	}

	// Mark entries as deleted if not keeping original
	if !req.KeepOriginal {
		for _, entry := range entriesToPromote {
			entry.MarkDeleted()
		}
		file.UpdateTimestamp()

		if err := s.store.WriteFile(req.SourceProject, req.Date, file); err != nil {
			return "", fmt.Errorf("updating journal after promote: %w", err)
		}
	}

	logger.WithFields(map[string]any{
		"source":  req.SourceProject,
		"date":    req.Date,
		"target":  req.TargetProject,
		"docPath": docPath,
		"entries": len(entriesToPromote),
	}).Info("journal entries promoted to document")

	s.emitEvent(events.EntryCreated, map[string]any{
		"type":      "document",
		"projectId": req.TargetProject,
		"path":      docPath,
		"title":     req.Title,
	})

	return docPath, nil
}

// SearchEntries searches journal entries across all dates for a project.
// Returns matching entries with their dates.
func (s *Service) SearchEntries(ctx context.Context, projectAlias, query string, limit int) ([]SearchResult, error) {
	if query == "" {
		return []SearchResult{}, nil
	}

	if limit <= 0 {
		limit = 50
	}

	queryLower := strings.ToLower(query)

	// Get all dates for the project
	dates, err := s.store.ListDates(projectAlias)
	if err != nil {
		return nil, fmt.Errorf("listing dates: %w", err)
	}

	var results []SearchResult
	for _, date := range dates {
		if len(results) >= limit {
			break
		}

		file, err := s.store.ReadFile(projectAlias, date)
		if err != nil {
			continue
		}

		for _, entry := range file.Entries {
			if entry.Deleted {
				continue
			}

			// Simple substring match (case-insensitive)
			contentLower := strings.ToLower(entry.Content)
			if strings.Contains(contentLower, queryLower) {
				results = append(results, SearchResult{
					ProjectAlias: projectAlias,
					Date:         date,
					Entry:        entry,
					Snippet:      createSnippet(entry.Content, query, 100),
				})
				if len(results) >= limit {
					break
				}
			}
		}
	}

	return results, nil
}

// SearchResult represents a journal entry search result.
type SearchResult struct {
	ProjectAlias string       `json:"projectAlias"`
	Date         string       `json:"date"`
	Entry        JournalEntry `json:"entry"`
	Snippet      string       `json:"snippet"`
}

// createSnippet creates a snippet around the matched query.
func createSnippet(content, query string, maxLen int) string {
	contentLower := strings.ToLower(content)
	queryLower := strings.ToLower(query)

	idx := strings.Index(contentLower, queryLower)
	if idx == -1 {
		if len(content) > maxLen {
			return content[:maxLen] + "..."
		}
		return content
	}

	// Calculate snippet bounds
	start := idx - 30
	if start < 0 {
		start = 0
	}

	end := idx + len(query) + 70
	if end > len(content) {
		end = len(content)
	}

	snippet := content[start:end]
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(content) {
		snippet = snippet + "..."
	}

	return snippet
}

// RestoreEntry restores a soft-deleted entry.
func (s *Service) RestoreEntry(ctx context.Context, projectAlias, date, entryID string) error {
	if err := ValidateDate(date); err != nil {
		return fmt.Errorf("invalid date: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := s.store.ReadFile(projectAlias, date)
	if err != nil {
		return fmt.Errorf("reading journal: %w", err)
	}

	entry := file.GetEntry(entryID)
	if entry == nil {
		return fmt.Errorf("entry not found: %s", entryID)
	}

	entry.Deleted = false
	file.UpdateTimestamp()

	if err := s.store.WriteFile(projectAlias, date, file); err != nil {
		return fmt.Errorf("writing journal: %w", err)
	}

	logger.WithFields(map[string]any{
		"project": projectAlias,
		"date":    date,
		"entryId": entryID,
	}).Info("journal entry restored")

	s.emitEvent(events.EntryRestored, map[string]any{
		"type":      "journal",
		"projectId": projectAlias,
		"date":      date,
		"entryId":   entryID,
	})

	return nil
}
