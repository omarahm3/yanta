package journal

import (
	"context"
)

// WailsService wraps Service for Wails binding.
// Methods must be exported and have ctx as first param for Wails v3.
type WailsService struct {
	svc *Service
}

// NewWailsService creates a new Wails-compatible journal service.
func NewWailsService(svc *Service) *WailsService {
	return &WailsService{svc: svc}
}

// AppendEntry adds a quick note to today's journal for the given project.
// Called from Quick Capture window.
func (ws *WailsService) AppendEntry(ctx context.Context, req AppendEntryRequest) (*JournalEntry, error) {
	return ws.svc.AppendEntry(ctx, req)
}

// AppendEntryToDate adds a quick note to a specific date's journal.
func (ws *WailsService) AppendEntryToDate(ctx context.Context, req AppendEntryRequestWithDate) (*JournalEntry, error) {
	return ws.svc.AppendEntryToDate(ctx, req)
}

// GetToday returns today's journal for a project.
func (ws *WailsService) GetToday(ctx context.Context, projectAlias string) (*JournalFile, error) {
	return ws.svc.GetToday(ctx, projectAlias)
}

// GetByDate returns a specific day's journal.
func (ws *WailsService) GetByDate(ctx context.Context, projectAlias, date string) (*JournalFile, error) {
	return ws.svc.GetByDate(ctx, projectAlias, date)
}

// GetActiveEntries returns non-deleted entries for a date.
func (ws *WailsService) GetActiveEntries(ctx context.Context, projectAlias, date string) ([]JournalEntry, error) {
	return ws.svc.GetActiveEntries(ctx, projectAlias, date)
}

// ListDates returns available journal dates for a project.
// If year and month are both 0, returns all dates.
func (ws *WailsService) ListDates(ctx context.Context, projectAlias string, year, month int) ([]string, error) {
	return ws.svc.ListDates(ctx, projectAlias, year, month)
}

// DeleteEntry soft-deletes an entry (sets deleted: true).
func (ws *WailsService) DeleteEntry(ctx context.Context, projectAlias, date, entryID string) error {
	return ws.svc.DeleteEntry(ctx, projectAlias, date, entryID)
}

// UpdateEntry edits an existing entry.
func (ws *WailsService) UpdateEntry(ctx context.Context, req UpdateEntryRequest) (*JournalEntry, error) {
	return ws.svc.UpdateEntry(ctx, req)
}

// PromoteToDocument converts journal entries to a full document.
func (ws *WailsService) PromoteToDocument(ctx context.Context, req PromoteRequest) (string, error) {
	return ws.svc.PromoteToDocument(ctx, req)
}

// RestoreEntry restores a soft-deleted entry.
func (ws *WailsService) RestoreEntry(ctx context.Context, projectAlias, date, entryID string) error {
	return ws.svc.RestoreEntry(ctx, projectAlias, date, entryID)
}

// SearchEntries searches journal entries across all dates for a project.
func (ws *WailsService) SearchEntries(ctx context.Context, projectAlias, query string, limit int) ([]SearchResult, error) {
	return ws.svc.SearchEntries(ctx, projectAlias, query, limit)
}
