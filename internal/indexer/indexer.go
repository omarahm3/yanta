package indexer

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"

	"yanta/internal/asset"
	"yanta/internal/document"
	"yanta/internal/git"
	"yanta/internal/link"
	"yanta/internal/search"
	"yanta/internal/tag"
	"yanta/internal/vault"
)

type Indexer struct {
	db          *sql.DB
	vault       *vault.Vault
	docStore    *document.Store
	ftsStore    *search.Store
	tagStore    *tag.Store
	linkStore   *link.Store
	assetStore  *asset.Store
	parser      *document.Parser
	syncManager *git.SyncManager
}

func New(
	db *sql.DB,
	v *vault.Vault,
	docStore *document.Store,
	ftsStore *search.Store,
	tagStore *tag.Store,
	linkStore *link.Store,
	assetStore *asset.Store,
	syncManager *git.SyncManager,
) *Indexer {
	return &Indexer{
		db:          db,
		vault:       v,
		docStore:    docStore,
		ftsStore:    ftsStore,
		tagStore:    tagStore,
		linkStore:   linkStore,
		assetStore:  assetStore,
		parser:      document.NewParser(),
		syncManager: syncManager,
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
			if err := idx.assetStore.LinkToDocumentTx(ctx, tx, hash, docPath); err != nil {
				return fmt.Errorf("linking asset to document: %w", err)
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
