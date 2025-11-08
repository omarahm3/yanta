package integration

import (
	"testing"

	"yanta/internal/document"
	"yanta/internal/project"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDocumentSaveWithLinks validates that when a user saves a document with links,
// those links are properly extracted and stored in the doc_link table.
// This is a critical test to prevent regression of the bug where documents with links
// failed to save due to incorrect BlockNote structure handling.
func TestDocumentSaveWithLinks(t *testing.T) {
	env := setupTestEnv(t)
	defer env.cleanup()

	projectAlias := "@test-project"
	ensureProjectDir(t, env, projectAlias)

	projectCache := project.NewCache(project.NewStore(env.db))
	docService := document.NewService(env.db, env.docStore, env.vault, env.indexer, projectCache)
	// Don't set context to avoid event emission in tests

	t.Run("save new document with links", func(t *testing.T) {
		docPath, err := docService.Save(document.SaveRequest{
			ProjectAlias: projectAlias,
			Title:        "Document with Links",
			Tags:         []string{"test", "links"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Check out ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://github.com/test/repo",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "our repository",
									Styles: map[string]any{},
								},
							},
						},
						{
							Type:   "text",
							Text:   " for more info.",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Also see ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://docs.example.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "documentation",
									Styles: map[string]any{},
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Document save should succeed")
		require.NotEmpty(t, docPath, "Document path should be returned")

		doc, err := env.docStore.GetByPath(env.ctx, docPath)
		require.NoError(t, err, "Should be able to retrieve saved document")
		assert.Equal(t, "Document with Links", doc.Title)
		assert.True(t, doc.HasLinks, "Document should be marked as having links")

		links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err, "Should be able to retrieve document links")
		require.Len(t, links, 2, "Should have exactly 2 links in doc_link table")

		linkURLs := []string{links[0].URL, links[1].URL}
		assert.Contains(t, linkURLs, "https://github.com/test/repo", "Should contain GitHub link")
		assert.Contains(t, linkURLs, "https://docs.example.com", "Should contain docs link")
	})

	t.Run("edit document and update links", func(t *testing.T) {
		docPath, err := docService.Save(document.SaveRequest{
			ProjectAlias: projectAlias,
			Title:        "Document to Edit",
			Tags:         []string{"editing"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Original link: ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://original.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "original",
									Styles: map[string]any{},
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Initial save should succeed")

		links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err)
		require.Len(t, links, 1, "Should have 1 link initially")
		assert.Equal(t, "https://original.com", links[0].URL)

		_, err = docService.Save(document.SaveRequest{
			Path:         docPath,
			ProjectAlias: projectAlias,
			Title:        "Document to Edit - Updated",
			Tags:         []string{"editing", "updated"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "New links: ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://new-link-1.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "first",
									Styles: map[string]any{},
								},
							},
						},
						{
							Type:   "text",
							Text:   " and ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://new-link-2.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "second",
									Styles: map[string]any{},
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Update should succeed")

		links, err = env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err, "Should retrieve updated links")
		require.Len(t, links, 2, "Should have 2 new links after update")

		linkURLs := []string{links[0].URL, links[1].URL}
		assert.Contains(t, linkURLs, "https://new-link-1.com", "Should contain first new link")
		assert.Contains(t, linkURLs, "https://new-link-2.com", "Should contain second new link")
		assert.NotContains(t, linkURLs, "https://original.com", "Old link should be removed")
	})

	t.Run("save document without links", func(t *testing.T) {
		docPath, err := docService.Save(document.SaveRequest{
			ProjectAlias: projectAlias,
			Title:        "Document without Links",
			Tags:         []string{"no-links"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Just plain text, no links here.",
							Styles: map[string]any{},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Document save should succeed")

		doc, err := env.docStore.GetByPath(env.ctx, docPath)
		require.NoError(t, err)
		assert.False(t, doc.HasLinks, "Document should not be marked as having links")

		links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err)
		assert.Len(t, links, 0, "Should have no links in doc_link table")
	})

	t.Run("remove all links from document", func(t *testing.T) {
		docPath, err := docService.Save(document.SaveRequest{
			ProjectAlias: projectAlias,
			Title:        "Document with Links to Remove",
			Tags:         []string{"removal-test"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type: "link",
							Href: "https://to-be-removed.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "link to remove",
									Styles: map[string]any{},
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err)
		require.Len(t, links, 1, "Should have 1 link initially")

		_, err = docService.Save(document.SaveRequest{
			Path:         docPath,
			ProjectAlias: projectAlias,
			Title:        "Document with Links to Remove - No Links",
			Tags:         []string{"removal-test"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "All links removed, just text now.",
							Styles: map[string]any{},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Update should succeed")

		doc, err := env.docStore.GetByPath(env.ctx, docPath)
		require.NoError(t, err)
		assert.False(t, doc.HasLinks, "Document should no longer be marked as having links")

		links, err = env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err)
		assert.Len(t, links, 0, "All links should be removed from doc_link table")
	})

	t.Run("document with multiple links in same paragraph", func(t *testing.T) {
		docPath, err := docService.Save(document.SaveRequest{
			ProjectAlias: projectAlias,
			Title:        "Multiple Links Test",
			Tags:         []string{"multiple-links"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:    uuid.New().String(),
					Type:  "paragraph",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Visit ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://site1.com",
							Content: []document.BlockNoteContent{
								{Type: "text", Text: "site1", Styles: map[string]any{}},
							},
						},
						{
							Type:   "text",
							Text:   ", ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://site2.com",
							Content: []document.BlockNoteContent{
								{Type: "text", Text: "site2", Styles: map[string]any{}},
							},
						},
						{
							Type:   "text",
							Text:   ", and ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://site3.com",
							Content: []document.BlockNoteContent{
								{Type: "text", Text: "site3", Styles: map[string]any{}},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err, "Should save document with multiple links in same paragraph")

		links, err := env.linkStore.GetDocumentLinks(env.ctx, docPath)
		require.NoError(t, err)
		require.Len(t, links, 3, "Should have all 3 links in doc_link table")

		linkURLs := make(map[string]bool)
		for _, link := range links {
			linkURLs[link.URL] = true
		}
		assert.True(t, linkURLs["https://site1.com"], "Should contain site1")
		assert.True(t, linkURLs["https://site2.com"], "Should contain site2")
		assert.True(t, linkURLs["https://site3.com"], "Should contain site3")
	})
}
