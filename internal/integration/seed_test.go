package integration

import (
	"encoding/json"
	"testing"
	"yanta/internal/document"
	"yanta/internal/seed"
)

// TestSeedDocuments_BlockNoteCompatibility validates that all seed documents
// are 100% BlockNote compatible. This prevents bugs where seed data has
// incorrect structure that causes save failures or editor errors.
func TestSeedDocuments_BlockNoteCompatibility(t *testing.T) {
	docs := seed.GetDemoDocuments()

	if len(docs) == 0 {
		t.Fatal("No demo documents returned")
	}

	for _, doc := range docs {
		t.Run(doc.Title, func(t *testing.T) {
			if doc.ProjectAlias == "" {
				t.Error("ProjectAlias is empty")
			}
			if doc.Title == "" {
				t.Error("Title is empty")
			}
			if len(doc.Blocks) == 0 {
				t.Error("Blocks is empty")
			}

			if err := document.ValidateBlockNoteStructure(doc.Blocks); err != nil {
				t.Errorf("Invalid BlockNote structure: %v", err)
			}

			for i, block := range doc.Blocks {
				if block.ID == "" {
					t.Errorf("Block %d missing ID", i)
				}
				if block.Type == "" {
					t.Errorf("Block %d missing Type", i)
				}

				if len(block.Content) > 0 {
					var contents []document.BlockNoteContent
					if err := json.Unmarshal(block.Content, &contents); err != nil {
						t.Errorf("Block %d: failed to unmarshal Content: %v", i, err)
						continue
					}

					for j, content := range contents {
						if content.Type == "" {
							t.Errorf("Block %d, Content %d missing Type", i, j)
						}

						if content.Type == "link" {
							if content.Href == "" {
								t.Errorf("Block %d, Content %d: link missing href", i, j)
							}
							if len(content.Content) == 0 {
								t.Errorf("Block %d, Content %d: link missing nested content", i, j)
							}
							for k, nested := range content.Content {
								if nested.Type == "" {
									t.Errorf("Block %d, Content %d, Nested %d missing Type", i, j, k)
								}
								if nested.Type == "text" && nested.Styles == nil {
									t.Errorf("Block %d, Content %d, Nested %d: text missing styles", i, j, k)
								}
							}
						}

						if content.Type == "text" && content.Styles == nil {
							t.Errorf("Block %d, Content %d: text missing styles", i, j)
						}
					}
				}
			}
		})
	}
}

// TestSeedDocuments_HasLinks validates that seed documents contain links
// for proper testing of the link extraction and indexing pipeline.
func TestSeedDocuments_HasLinks(t *testing.T) {
	docs := seed.GetDemoDocuments()

	linkCount := 0
	for _, doc := range docs {
		for _, block := range doc.Blocks {
			if len(block.Content) == 0 {
				continue
			}
			var contents []document.BlockNoteContent
			if err := json.Unmarshal(block.Content, &contents); err != nil {
				continue
			}
			for _, content := range contents {
				if content.Type == "link" {
					linkCount++
					t.Logf("Found link in '%s': %s", doc.Title, content.Href)
				}
			}
		}
	}

	if linkCount == 0 {
		t.Error("No links found in seed documents - links should be present for testing")
	}

	expectedLinks := 3
	if linkCount != expectedLinks {
		t.Errorf("Expected %d links in seed documents, got %d", expectedLinks, linkCount)
	}
}
