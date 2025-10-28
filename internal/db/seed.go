package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"yanta/internal/logger"

	"github.com/google/uuid"
)

func SeedProjects(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM project WHERE deleted_at IS NULL").Scan(&count); err != nil {
		return fmt.Errorf("failed to check project count: %w", err)
	}

	if count > 0 {
		logger.Debug("projects already exist, skipping seed")
		return nil
	}

	logger.Info("seeding demo projects...")

	projects := []struct {
		name      string
		alias     string
		startDate string
	}{
		{"Work", "@work", time.Now().Format("2006-01-02")},
		{"Personal", "@personal", time.Now().Format("2006-01-02")},
		{"Learning", "@learning", time.Now().AddDate(0, 0, -30).Format("2006-01-02")},
	}

	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().Format("2006-01-02 15:04:05.000")

	for _, p := range projects {
		projectID := uuid.New().String()

		_, err := tx.ExecContext(ctx, `
			INSERT INTO project (id, name, alias, start_date, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, projectID, p.name, p.alias, p.startDate, now, now)
		if err != nil {
			return fmt.Errorf("failed to insert project %s: %w", p.name, err)
		}

		logger.Debugf("seeded project: %s (%s)", p.name, p.alias)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit seed transaction: %w", err)
	}

	logger.Info("demo projects seeded successfully")
	return nil
}

type SeedDocument struct {
	ProjectAlias string
	Title        string
	Content      []SeedBlock
	Tags         []string
}

type SeedBlock struct {
	Type    string         `json:"type"`
	Content any            `json:"content,omitempty"`
	Props   map[string]any `json:"props,omitempty"`
}

func GetDemoDocuments() []SeedDocument {
	return []SeedDocument{
		{
			ProjectAlias: "@work",
			Title:        "Project Kickoff Notes",
			Tags:         []string{"meeting", "planning"},
			Content: []SeedBlock{
				{
					Type: "heading",
					Props: map[string]any{
						"level": float64(1),
					},
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Project Kickoff Notes",
						},
					},
				},
				{
					Type: "paragraph",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Discussed project goals and timelines with the team.",
						},
					},
				},
				{
					Type: "bulletListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Milestone 1: Requirements gathering",
						},
					},
				},
				{
					Type: "bulletListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Milestone 2: Implementation phase",
						},
					},
				},
			},
		},
		{
			ProjectAlias: "@personal",
			Title:        "Reading List",
			Tags:         []string{"books", "learning"},
			Content: []SeedBlock{
				{
					Type: "heading",
					Props: map[string]any{
						"level": float64(1),
					},
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Books to Read",
						},
					},
				},
				{
					Type: "paragraph",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "My current reading list for this quarter:",
						},
					},
				},
				{
					Type: "numberedListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Clean Architecture - Robert Martin",
						},
					},
				},
				{
					Type: "numberedListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Designing Data-Intensive Applications - Martin Kleppmann",
						},
					},
				},
			},
		},
		{
			ProjectAlias: "@learning",
			Title:        "Go Best Practices",
			Tags:         []string{"golang", "programming"},
			Content: []SeedBlock{
				{
					Type: "heading",
					Props: map[string]any{
						"level": float64(1),
					},
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Go Best Practices",
						},
					},
				},
				{
					Type: "paragraph",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Key principles for writing idiomatic Go code:",
						},
					},
				},
				{
					Type: "bulletListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Accept interfaces, return structs",
						},
					},
				},
				{
					Type: "bulletListItem",
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "Handle errors explicitly",
						},
					},
				},
				{
					Type: "codeBlock",
					Props: map[string]any{
						"language": "go",
					},
					Content: []any{
						map[string]any{
							"type": "text",
							"text": "if err := doSomething(); err != nil {\n    return fmt.Errorf(\"operation failed: %w\", err)\n}",
						},
					},
				},
			},
		},
	}
}

func (sd *SeedDocument) ToBlockNoteJSON() ([]byte, error) {
	blocks := make([]map[string]any, len(sd.Content))

	for i, block := range sd.Content {
		blockMap := map[string]any{
			"id":   uuid.New().String(),
			"type": block.Type,
		}

		if block.Content != nil {
			blockMap["content"] = block.Content
		}

		if block.Props != nil {
			blockMap["props"] = block.Props
		} else {
			blockMap["props"] = map[string]any{}
		}

		blocks[i] = blockMap
	}

	return json.MarshalIndent(blocks, "", "  ")
}
