// Package blocktype defines the BlockNote block-type names and inline style
// keys the backend understands.
//
// These strings previously lived as magic literals in four independent type
// switches — FTS extraction (internal/document/parser.go), Markdown export
// (internal/document/markdown.go), PDF export (internal/export/renderer.go) and
// the Markdown codec (internal/blocknote/blocknote.go). Centralizing them makes
// a rename a single-point change and lets Known() flag types that would
// otherwise fall through a default branch with no signal.
package blocktype

// Block types.
const (
	Heading          = "heading"
	Paragraph        = "paragraph"
	CodeBlock        = "codeBlock"
	BulletListItem   = "bulletListItem"
	NumberedListItem = "numberedListItem"
	CheckListItem    = "checkListItem"
	Image            = "image"
	File             = "file"
	Quote            = "quote"
	Table            = "table"
)

// Inline content types.
const (
	InlineText = "text"
	InlineLink = "link"
)

// Inline style keys.
const (
	StyleBold   = "bold"
	StyleItalic = "italic"
	StyleCode   = "code"
	StyleStrike = "strike"
)

// Known reports whether t is a block type the backend renders explicitly.
func Known(t string) bool {
	switch t {
	case Heading, Paragraph, CodeBlock, BulletListItem, NumberedListItem,
		CheckListItem, Image, File, Quote, Table:
		return true
	default:
		return false
	}
}
