// Package indexer provides document indexing and file system watching functionality.
package indexer

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/journal"
	"yanta/internal/link"
	"yanta/internal/logger"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/strutil"
	"yanta/internal/tag"
	"yanta/internal/vault"

	"github.com/google/uuid"
)

type Indexer struct {
	db           *sql.DB
	vault        *vault.Vault
	docStore     *document.Store
	projectStore *project.Store
	ftsStore     *search.Store
	tagStore     *tag.Store
	linkStore    *link.Store
	assetStore   *asset.Store
	parser       *document.Parser
	syncManager  *git.SyncManager
	eventBus     *events.EventBus
}

func New(
	db *sql.DB,
	v *vault.Vault,
	docStore *document.Store,
	projectStore *project.Store,
	ftsStore *search.Store,
	tagStore *tag.Store,
	linkStore *link.Store,
	assetStore *asset.Store,
	syncManager *git.SyncManager,
	eventBus *events.EventBus,
) *Indexer {
	return &Indexer{
		db:           db,
		vault:        v,
		docStore:     docStore,
		projectStore: projectStore,
		ftsStore:     ftsStore,
		tagStore:     tagStore,
		linkStore:    linkStore,
		assetStore:   assetStore,
		parser:       document.NewParser(),
		syncManager:  syncManager,
		eventBus:     eventBus,
	}
}

func (idx *Indexer) ScanAndIndexProjects(ctx context.Context) error {
	projectsPath := filepath.Join(idx.vault.RootPath(), "projects")

	entries, err := os.ReadDir(projectsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("reading projects directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		projectAlias := entry.Name()

		if !strings.HasPrefix(projectAlias, "@") {
			continue
		}

		if idx.vault.ProjectMetadataExists(projectAlias) {
			metadata, err := idx.vault.ReadProjectMetadata(projectAlias)
			if err != nil {
				return fmt.Errorf("reading metadata for %s: %w", projectAlias, err)
			}

			existing, err := idx.projectStore.GetByAlias(ctx, projectAlias)
			if err == nil {
				if existing.Name != metadata.Name || existing.StartDate != metadata.StartDate || existing.EndDate != metadata.EndDate {
					existing.Name = metadata.Name
					existing.StartDate = metadata.StartDate
					existing.EndDate = metadata.EndDate
					existing.UpdatedAt = time.Now().Format(time.RFC3339)
					if _, err := idx.projectStore.Update(ctx, existing); err != nil {
						return fmt.Errorf("updating project %s: %w", projectAlias, err)
					}
				}
			} else {
				p := &project.Project{
					ID:        uuid.New().String(),
					Name:      metadata.Name,
					Alias:     metadata.Alias,
					StartDate: metadata.StartDate,
					EndDate:   metadata.EndDate,
					CreatedAt: metadata.CreatedAt,
					UpdatedAt: metadata.UpdatedAt,
					DeletedAt: "",
				}
				if _, err := idx.projectStore.Create(ctx, p); err != nil {
					return fmt.Errorf("creating project %s: %w", projectAlias, err)
				}
			}
		} else {
			_, err := idx.projectStore.GetByAlias(ctx, projectAlias)
			if err != nil {
				aliasWithoutAt := strings.TrimPrefix(projectAlias, "@")
				name := strings.ReplaceAll(aliasWithoutAt, "-", " ")
				name = strutil.ToTitle(name)

				p := &project.Project{
					ID:        uuid.New().String(),
					Name:      name,
					Alias:     projectAlias,
					StartDate: "",
					EndDate:   "",
					CreatedAt: time.Now().Format(time.RFC3339),
					UpdatedAt: time.Now().Format(time.RFC3339),
					DeletedAt: "",
				}
				if _, err := idx.projectStore.Create(ctx, p); err != nil {
					return fmt.Errorf("creating project %s: %w", projectAlias, err)
				}

				metadata := &vault.ProjectMetadata{
					Alias:     p.Alias,
					Name:      p.Name,
					StartDate: p.StartDate,
					EndDate:   p.EndDate,
					CreatedAt: p.CreatedAt,
					UpdatedAt: p.UpdatedAt,
				}
				if err := idx.vault.WriteProjectMetadata(metadata); err != nil {
					return fmt.Errorf("writing metadata for %s: %w", projectAlias, err)
				}
			}
		}
	}

	return nil
}

// ScanAndIndexVault scans the vault directory and indexes all documents.
// It returns the paths of any corrupt/unreadable files that were skipped,
// so callers can surface a warning to the user. The scan never aborts on a
// single corrupt file — all healthy files are indexed regardless.
func (idx *Indexer) ScanAndIndexVault(ctx context.Context) ([]string, error) {
	if err := idx.ScanAndIndexProjects(ctx); err != nil {
		return nil, fmt.Errorf("scanning projects: %w", err)
	}

	projectsPath := filepath.Join(idx.vault.RootPath(), "projects")

	entries, err := os.ReadDir(projectsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading projects directory: %w", err)
	}

	var docPaths []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		projectAlias := entry.Name()

		if !strings.HasPrefix(projectAlias, "@") {
			continue
		}

		projectPath := filepath.Join(projectsPath, projectAlias)

		docEntries, err := os.ReadDir(projectPath)
		if err != nil {
			continue
		}

		for _, docEntry := range docEntries {
			if docEntry.IsDir() || !strings.HasSuffix(docEntry.Name(), ".json") {
				continue
			}

			if docEntry.Name() == vault.ProjectMetadataFileName {
				continue
			}

			relativePath := vault.NormalizeDocumentPath(filepath.Join("projects", projectAlias, docEntry.Name()))

			if relativePath == "" {
				continue
			}

			docPaths = append(docPaths, relativePath)
		}
	}

	total := len(docPaths)
	idx.emitProgress(0, total, "Indexing documents...")

	var corruptPaths []string
	for i, docPath := range docPaths {
		if err := idx.IndexDocument(ctx, docPath); err != nil {
			if !errors.Is(err, document.ErrCorrupted) {
				return nil, fmt.Errorf("indexing document %s: %w", docPath, err)
			}

			logger.Warnf("skipping corrupt document %s: %v", docPath, err)
			corruptPaths = append(corruptPaths, docPath)
			continue
		}

		if (i+1)%10 == 0 || i == total-1 {
			idx.emitProgress(i+1, total, fmt.Sprintf("Indexed %d/%d documents", i+1, total))
		}
	}

	// Index all journals
	if err := idx.IndexAllJournals(ctx); err != nil {
		logger.Warnf("failed to index journals: %v", err)
	}

	return corruptPaths, nil
}

func (idx *Indexer) emitProgress(current, total int, message string) {
	if idx.eventBus != nil {
		idx.eventBus.Emit("reindex:progress", map[string]interface{}{
			"current": current,
			"total":   total,
			"message": message,
		})
	}
}

func (idx *Indexer) IndexDocument(ctx context.Context, docPath string) error {
	reader := document.NewFileReader(idx.vault)
	docFile, err := reader.ReadFile(docPath)
	if err != nil {
		return fmt.Errorf("reading document file: %w", err)
	}

	fullPath, err := idx.vault.DocumentPath(docPath)
	if err != nil {
		return fmt.Errorf("getting document full path: %w", err)
	}

	stat, err := os.Stat(fullPath)
	if err != nil {
		return fmt.Errorf("stating document file: %w", err)
	}

	content, err := idx.parser.Parse(docFile)
	if err != nil {
		return fmt.Errorf("parsing document blocks: %w", err)
	}

	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	kind := docFile.Kind
	if kind == "" {
		kind = document.DocumentKindDocument
	}

	doc := &document.Document{
		Path:             docPath,
		ProjectAlias:     docFile.Meta.Project,
		Title:            docFile.Meta.Title,
		Kind:             kind,
		ModificationTime: stat.ModTime().UnixNano(),
		Size:             stat.Size(),
		HasCode:          content.HasCode,
		HasImages:        content.HasImages,
		HasLinks:         content.HasLinks,
	}

	// Resolve existence against ALL rows, including soft-deleted ones. A
	// soft-deleted (archived) document keeps its .json on disk, so a plain
	// GetByPathTx (which hides deleted rows) would report "not found" and send us
	// to CreateTx — an INSERT that conflicts on the still-present path PRIMARY KEY,
	// failing the index and aborting a whole vault scan. Skip archived docs (they
	// belong out of the active index until restored), update active ones, create
	// genuinely new ones.
	existing, err := idx.docStore.GetByPathIncludingDeletedTx(ctx, tx, docPath)
	switch {
	case err == nil && existing.DeletedAt != "":
		return nil
	case err == nil:
		if _, err = idx.docStore.UpdateTx(ctx, tx, doc); err != nil {
			return fmt.Errorf("updating doc table: %w", err)
		}
	case errors.Is(err, sql.ErrNoRows):
		if _, err = idx.docStore.CreateTx(ctx, tx, doc); err != nil {
			return fmt.Errorf("creating doc table entry: %w", err)
		}
	default:
		return fmt.Errorf("checking existing doc: %w", err)
	}

	headingsText := strings.Join(content.Headings, " ")
	bodyText := strings.Join(content.Body, " ")
	codeText := strings.Join(content.Code, " ")

	err = idx.ftsStore.UpdateDocumentTx(ctx, tx, docPath, content.Title, headingsText, bodyText, codeText)
	if err != nil {
		return fmt.Errorf("updating fts_doc: %w", err)
	}

	err = idx.tagStore.RemoveAllDocumentTagsTx(ctx, tx, docPath)
	if err != nil {
		return fmt.Errorf("removing existing tags: %w", err)
	}

	if len(docFile.Meta.Tags) > 0 {
		err = idx.tagStore.AddTagsToDocumentTx(ctx, tx, docPath, docFile.Meta.Tags)
		if err != nil {
			return fmt.Errorf("adding document tags: %w", err)
		}
	}

	err = idx.linkStore.RemoveAllDocumentLinksTx(ctx, tx, docPath)
	if err != nil {
		return fmt.Errorf("removing existing links: %w", err)
	}

	if len(content.Links) > 0 {
		links := make([]*link.Link, 0, len(content.Links))
		for _, docLink := range content.Links {
			l, err := link.New(docLink.URL)
			if err != nil {
				continue
			}
			links = append(links, l)
		}

		if len(links) > 0 {
			err = idx.linkStore.AddLinksTx(ctx, tx, docPath, links)
			if err != nil {
				return fmt.Errorf("adding document links: %w", err)
			}
		}
	}

	// Reset asset links for this document, then re-add from parsed content
	if err := idx.assetStore.UnlinkAllFromDocumentTx(ctx, tx, docPath); err != nil {
		return fmt.Errorf("unlinking document assets: %w", err)
	}
	if len(content.Assets) > 0 {
		for _, as := range content.Assets {
			url := as.Path
			// Refs come as /assets/{projectAlias}/{hash}{ext} or wails://assets/...
			// (both contain "/assets/"). Parse from that segment with the canonical
			// asset.ParseAssetRef so the hash is the fixed 64-char prefix and
			// extension-less refs are handled the same way everywhere.
			i := strings.Index(url, "/assets/")
			if i == -1 {
				continue
			}
			hash, _, err := asset.ParseAssetRef(url[i:])
			if err != nil {
				continue
			}

			// Check if asset exists before trying to link.
			// If asset doesn't exist yet (e.g., upload still in progress), skip gracefully.
			// The frontend has a fallback mechanism via LinkToDocument to handle this case.
			existingAsset, checkErr := idx.assetStore.GetByHashTx(ctx, tx, hash)
			if checkErr != nil {
				// Asset not visible in this transaction - expected during concurrent upload+save.
				// Frontend will link via LinkToDocument after both transactions complete.
				logger.WithFields(map[string]any{
					"hash":    hash,
					"docPath": docPath,
				}).Debug("asset not yet visible in transaction, frontend will link")
				continue
			}

			logger.WithFields(map[string]any{
				"hash":    hash,
				"docPath": docPath,
				"ext":     existingAsset.Ext,
			}).Debug("asset exists, proceeding to link")

			if err := idx.assetStore.LinkToDocumentTx(ctx, tx, hash, docPath); err != nil {
				// Log but don't fail - asset linking is not critical for document save.
				// Frontend will handle via LinkToDocument if needed.
				logger.WithError(err).WithFields(map[string]any{
					"hash":    hash,
					"docPath": docPath,
				}).Warn("failed to link asset to document, continuing")
				continue
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	idx.syncManager.NotifyChange(fmt.Sprintf("indexed %s", docPath))

	return nil
}

func (idx *Indexer) ReindexDocument(ctx context.Context, docPath string) error {
	return idx.IndexDocument(ctx, docPath)
}

func (idx *Indexer) RemoveDocument(ctx context.Context, docPath string) error {
	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	err = idx.ftsStore.DeleteDocumentTx(ctx, tx, docPath)
	if err != nil && !strings.Contains(err.Error(), "not found") {
		return fmt.Errorf("removing from fts_doc: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	idx.syncManager.NotifyChange(fmt.Sprintf("removed %s", docPath))

	return nil
}

func (idx *Indexer) RemoveDocumentCompletely(ctx context.Context, docPath string) error {
	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	err = idx.ftsStore.DeleteDocumentTx(ctx, tx, docPath)
	if err != nil && !strings.Contains(err.Error(), "not found") {
		return fmt.Errorf("removing from fts_doc: %w", err)
	}

	err = idx.docStore.HardDeleteTx(ctx, tx, docPath)
	if err != nil && !strings.Contains(err.Error(), "not found") {
		return fmt.Errorf("removing from doc table: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	idx.syncManager.NotifyChange(fmt.Sprintf("removed %s completely", docPath))

	return nil
}

func (idx *Indexer) ClearIndex(ctx context.Context) error {
	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	err = idx.ftsStore.DeleteAllTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("clearing fts_doc: %w", err)
	}

	err = idx.ftsStore.DeleteAllJournalEntriesTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("clearing fts_journal: %w", err)
	}

	_, err = tx.ExecContext(ctx, "DELETE FROM doc")
	if err != nil {
		return fmt.Errorf("clearing doc table: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

// IndexAllJournals indexes all existing journal entries into fts_journal.
func (idx *Indexer) IndexAllJournals(ctx context.Context) error {
	// Clear existing journal FTS entries first
	if err := idx.ftsStore.DeleteAllJournalEntries(ctx); err != nil {
		return fmt.Errorf("clearing fts_journal: %w", err)
	}

	projectsPath := filepath.Join(idx.vault.RootPath(), "projects")

	entries, err := os.ReadDir(projectsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("reading projects directory: %w", err)
	}

	var totalEntries int
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "@") {
			continue
		}

		projectAlias := entry.Name()
		journalDir := filepath.Join(projectsPath, projectAlias, "journal")

		journalFiles, err := os.ReadDir(journalDir)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			logger.Warnf("failed to read journal directory for %s: %v", projectAlias, err)
			continue
		}

		for _, journalFile := range journalFiles {
			if journalFile.IsDir() || !strings.HasSuffix(journalFile.Name(), ".json") {
				continue
			}

			// Extract date from filename (e.g., "2026-01-30.json" -> "2026-01-30")
			date := strings.TrimSuffix(journalFile.Name(), ".json")
			if journal.ValidateDate(date) != nil {
				continue
			}

			journalPath := filepath.Join(journalDir, journalFile.Name())
			data, err := os.ReadFile(journalPath)
			if err != nil {
				logger.Warnf("failed to read journal file %s: %v", journalPath, err)
				continue
			}

			var file journal.JournalFile
			if err := json.Unmarshal(data, &file); err != nil {
				logger.Warnf("failed to parse journal file %s: %v", journalPath, err)
				continue
			}

			for _, entry := range file.Entries {
				if entry.Deleted {
					continue
				}

				if err := idx.ftsStore.InsertJournalEntry(ctx, projectAlias, date, entry.ID, entry.Content, entry.Tags); err != nil {
					logger.Warnf("failed to index journal entry %s/%s/%s: %v", projectAlias, date, entry.ID, err)
					continue
				}
				totalEntries++
			}
		}
	}

	logger.WithField("totalEntries", totalEntries).Info("indexed journal entries")
	return nil
}

type PathChange struct {
	Status  string
	Path    string
	OldPath string
}

func (idx *Indexer) ReindexPaths(ctx context.Context, changes []PathChange) ([]string, error) {
	var corruptPaths []string
	var journalDates map[string]map[string]bool

	for _, change := range changes {
		p := change.Path
		if !strings.HasPrefix(p, "projects/") || !strings.HasSuffix(p, ".json") {
			continue
		}

		if isJournalPath(p) {
			if journalDates == nil {
				journalDates = make(map[string]map[string]bool)
			}
			addJournalDate := func(alias, date string) {
				if alias == "" || date == "" {
					return
				}
				if journalDates[alias] == nil {
					journalDates[alias] = make(map[string]bool)
				}
				journalDates[alias][date] = true
			}
			alias, date := parseJournalPath(p)
			addJournalDate(alias, date)
			// On rename/copy also reindex the old date so its stale entries are
			// cleared instead of orphaned in fts_journal.
			if change.OldPath != "" && isJournalPath(change.OldPath) {
				oldAlias, oldDate := parseJournalPath(change.OldPath)
				addJournalDate(oldAlias, oldDate)
			}
			continue
		}

		switch change.Status {
		case "D":
			if err := idx.RemoveDocumentCompletely(ctx, p); err != nil {
				logger.Warnf("failed to remove deleted document %s: %v", p, err)
			}
		case "A", "M":
			if err := idx.IndexDocument(ctx, p); err != nil {
				if errors.Is(err, document.ErrCorrupted) {
					logger.Warnf("skipping corrupt document %s: %v", p, err)
					corruptPaths = append(corruptPaths, p)
					continue
				}
				return corruptPaths, fmt.Errorf("indexing document %s: %w", p, err)
			}
		case "R", "C":
			if change.OldPath != "" {
				if err := idx.RemoveDocumentCompletely(ctx, change.OldPath); err != nil {
					logger.Warnf("failed to remove old path %s during rename: %v", change.OldPath, err)
				}
			}
			if err := idx.IndexDocument(ctx, p); err != nil {
				if errors.Is(err, document.ErrCorrupted) {
					logger.Warnf("skipping corrupt document %s: %v", p, err)
					corruptPaths = append(corruptPaths, p)
					continue
				}
				return corruptPaths, fmt.Errorf("indexing document %s: %w", p, err)
			}
		}
	}

	for alias, dates := range journalDates {
		for date := range dates {
			if err := idx.reindexJournalDate(ctx, alias, date); err != nil {
				logger.Warnf("failed to reindex journal %s/%s: %v", alias, date, err)
			}
		}
	}

	return corruptPaths, nil
}

func isJournalPath(p string) bool {
	parts := strings.Split(p, "/")
	return len(parts) >= 4 && parts[2] == "journal"
}

func parseJournalPath(p string) (alias, date string) {
	parts := strings.Split(p, "/")
	if len(parts) < 4 || parts[2] != "journal" {
		return "", ""
	}
	alias = parts[1]
	date = strings.TrimSuffix(parts[3], ".json")
	return alias, date
}

func (idx *Indexer) reindexJournalDate(ctx context.Context, projectAlias, date string) error {
	journalDir := filepath.Join(idx.vault.RootPath(), "projects", projectAlias, "journal")
	journalFile := filepath.Join(journalDir, date+".json")

	data, err := os.ReadFile(journalFile)
	if err != nil {
		if os.IsNotExist(err) {
			// File gone (deleted/renamed away): just clear its stale entries.
			return idx.ftsStore.DeleteJournalEntriesByDate(ctx, projectAlias, date)
		}
		return fmt.Errorf("reading journal file: %w", err)
	}

	var file journal.JournalFile
	if err := json.Unmarshal(data, &file); err != nil {
		logger.Warnf("failed to parse journal file %s: %v", journalFile, err)
		return nil
	}

	// Clear + reinsert in a single transaction so a mid-way failure can't leave
	// the journal FTS index for this date partially populated.
	tx, err := idx.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	if err := idx.ftsStore.DeleteJournalEntriesByDateTx(ctx, tx, projectAlias, date); err != nil {
		return fmt.Errorf("clearing journal entries for %s/%s: %w", projectAlias, date, err)
	}

	for _, entry := range file.Entries {
		if entry.Deleted {
			continue
		}
		if err := idx.ftsStore.InsertJournalEntryTx(ctx, tx, projectAlias, date, entry.ID, entry.Content, entry.Tags); err != nil {
			logger.Warnf("failed to index journal entry %s/%s/%s: %v", projectAlias, date, entry.ID, err)
		}
	}
	return tx.Commit()
}
