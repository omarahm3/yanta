package seed

import (
	"yanta/internal/document"

	"github.com/google/uuid"
)

type Document struct {
	ProjectAlias string
	Title        string
	Blocks       []document.BlockNoteBlock
	Tags         []string
}

func GetDemoDocuments() []Document {
	return []Document{
		{
			ProjectAlias: "@work",
			Title:        "Project Kickoff Notes",
			Tags:         []string{"meeting", "planning"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   uuid.New().String(),
					Type: "heading",
					Props: map[string]any{
						"level": 1,
					},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Project Kickoff Notes",
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
							Text:   "Discussed project goals and timelines with the team. Check out our ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://github.com/company/project",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "project repository",
									Styles: map[string]any{},
								},
							},
						},
						{
							Type:   "text",
							Text:   " for more details.",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "bulletListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Milestone 1: Requirements gathering",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "bulletListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Milestone 2: Implementation phase",
							Styles: map[string]any{},
						},
					},
				},
			},
		},
		{
			ProjectAlias: "@personal",
			Title:        "Reading List",
			Tags:         []string{"books", "learning"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   uuid.New().String(),
					Type: "heading",
					Props: map[string]any{
						"level": 1,
					},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Books to Read",
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
							Text:   "My current reading list for this quarter. Find reviews on ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://www.goodreads.com",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "Goodreads",
									Styles: map[string]any{},
								},
							},
						},
						{
							Type:   "text",
							Text:   ":",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "numberedListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Clean Architecture - Robert Martin",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "numberedListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Designing Data-Intensive Applications - Martin Kleppmann",
							Styles: map[string]any{},
						},
					},
				},
			},
		},
		{
			ProjectAlias: "@learning",
			Title:        "Go Best Practices",
			Tags:         []string{"golang", "programming"},
			Blocks: []document.BlockNoteBlock{
				{
					ID:   uuid.New().String(),
					Type: "heading",
					Props: map[string]any{
						"level": 1,
					},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Go Best Practices",
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
							Text:   "Key principles for writing idiomatic Go code. Learn more from ",
							Styles: map[string]any{},
						},
						{
							Type: "link",
							Href: "https://go.dev/doc/effective_go",
							Content: []document.BlockNoteContent{
								{
									Type:   "text",
									Text:   "Effective Go",
									Styles: map[string]any{},
								},
							},
						},
						{
							Type:   "text",
							Text:   ":",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "bulletListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Accept interfaces, return structs",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:    uuid.New().String(),
					Type:  "bulletListItem",
					Props: map[string]any{},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "Handle errors explicitly",
							Styles: map[string]any{},
						},
					},
				},
				{
					ID:   uuid.New().String(),
					Type: "codeBlock",
					Props: map[string]any{
						"language": "go",
					},
					Content: []document.BlockNoteContent{
						{
							Type:   "text",
							Text:   "if err := doSomething(); err != nil {\n    return fmt.Errorf(\"operation failed: %w\", err)\n}",
							Styles: map[string]any{},
						},
					},
				},
			},
		},
	}
}
