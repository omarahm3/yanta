package indexer

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
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

func (idx *Indexer) ScanAndIndexVault(ctx context.Context) error {
	if err := idx.ScanAndIndexProjects(ctx); err != nil {
		return fmt.Errorf("scanning projects: %w", err)
	}

	projectsPath := filepath.Join(idx.vault.RootPath(), "projects")

	entries, err := os.ReadDir(projectsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("reading projects directory: %w", err)
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

	for i, docPath := range docPaths {
		if err := idx.IndexDocument(ctx, docPath); err != nil {
			logger.Warnf("failed to index document %s: %v", docPath, err)
			continue
		}

		if (i+1)%10 == 0 || i == total-1 {
			idx.emitProgress(i+1, total, fmt.Sprintf("Indexed %d/%d documents", i+1, total))
		}
	}

	return nil
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

	doc := &document.Document{
		Path:             docPath,
		ProjectAlias:     docFile.Meta.Project,
		Title:            docFile.Meta.Title,
		ModificationTime: stat.ModTime().UnixNano(),
		Size:             stat.Size(),
		HasCode:          content.HasCode,
		HasImages:        content.HasImages,
		HasLinks:         content.HasLinks,
	}

	_, err = idx.docStore.GetByPathTx(ctx, tx, docPath)
	exists := (err == nil)

	if exists {
		_, err = idx.docStore.UpdateTx(ctx, tx, doc)
		if err != nil {
			return fmt.Errorf("updating doc table: %w", err)
		}
	} else {
		_, err = idx.docStore.CreateTx(ctx, tx, doc)
		if err != nil {
			return fmt.Errorf("creating doc table entry: %w", err)
		}
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
			// Expected form: /assets/{projectAlias}/{hash}{ext} or wails://assets/... (both contain "/assets/")
			i := strings.Index(url, "/assets/")
			if i == -1 {
				continue
			}
			tail := url[i+len("/assets/"):]
			parts := strings.SplitN(tail, "/", 2)
			if len(parts) != 2 {
				continue
			}
			file := parts[1]
			dot := strings.LastIndex(file, ".")
			if dot <= 0 {
				continue
			}
			hash := file[:dot]
			if err := asset.ValidateHash(hash); err != nil {
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

	_, err = tx.ExecContext(ctx, "DELETE FROM doc")
	if err != nil {
		return fmt.Errorf("clearing doc table: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}
