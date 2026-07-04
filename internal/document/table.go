package document

// TableContent is BlockNote's table-block sub-schema: rows of cells, each cell
// holding inline content. Shared by the FTS parser and the PDF renderer so the
// shape is defined once (the Markdown codec in internal/blocknote keeps its own
// mirror because that package is deliberately standalone).
type TableContent struct {
	Type         string     `json:"type"`
	ColumnWidths []any      `json:"columnWidths"`
	Rows         []TableRow `json:"rows"`
}

type TableRow struct {
	Cells []TableCell `json:"cells"`
}

type TableCell struct {
	Type    string             `json:"type"`
	Content []BlockNoteContent `json:"content"`
	Props   map[string]any     `json:"props"`
}
