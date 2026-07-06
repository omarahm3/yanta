package blocknote

import (
	"encoding/json"
	"strings"
	"testing"

	"yanta/internal/blocktype"
)

func TestMarkdownToBlocks_Divider(t *testing.T) {
	for _, mark := range []string{"---", "***", "___"} {
		blocks := MarkdownToBlocks("above\n\n" + mark + "\n\nbelow")
		if len(blocks) != 3 {
			t.Fatalf("%q: got %d blocks, want 3", mark, len(blocks))
		}
		if blocks[1].Type != blocktype.Divider {
			t.Errorf("%q: block[1] type = %q, want divider", mark, blocks[1].Type)
		}
		if blocks[1].Content != nil {
			t.Errorf("%q: divider must have no content, got %s", mark, blocks[1].Content)
		}
	}
}

func TestMarkdownToBlocks_Table(t *testing.T) {
	md := "| Col A | Col B |\n| --- | --- |\n| a1 | `b1` |\n| a2 | b2 |"
	blocks := MarkdownToBlocks(md)
	if len(blocks) != 1 {
		t.Fatalf("got %d blocks, want 1", len(blocks))
	}
	tbl := blocks[0]
	if tbl.Type != blocktype.Table {
		t.Fatalf("block type = %q, want table", tbl.Type)
	}

	var tc struct {
		Type         string `json:"type"`
		ColumnWidths []any  `json:"columnWidths"`
		Rows         []struct {
			Cells []struct {
				Type    string         `json:"type"`
				Content []Inline       `json:"content"`
				Props   map[string]any `json:"props"`
			} `json:"cells"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(tbl.Content, &tc); err != nil {
		t.Fatalf("unmarshal table content: %v", err)
	}
	if tc.Type != "tableContent" {
		t.Errorf("content type = %q, want tableContent", tc.Type)
	}
	if len(tc.ColumnWidths) != 2 {
		t.Errorf("columnWidths len = %d, want 2", len(tc.ColumnWidths))
	}
	if len(tc.Rows) != 3 {
		t.Fatalf("rows = %d, want 3 (header + 2 data)", len(tc.Rows))
	}
	if got := tc.Rows[0].Cells[0].Content[0].Text; got != "Col A" {
		t.Errorf("header cell = %q, want Col A", got)
	}
	if tc.Rows[0].Cells[0].Type != "tableCell" {
		t.Errorf("cell type = %q, want tableCell", tc.Rows[0].Cells[0].Type)
	}
	// inline styles inside cells are parsed
	codeCell := tc.Rows[1].Cells[1].Content[0]
	if codeCell.Text != "b1" || codeCell.Styles["code"] != true {
		t.Errorf("cell b1 = %+v, want code-styled text", codeCell)
	}
}

func TestRoundTrip_TableAndDivider(t *testing.T) {
	md := "| H1 | H2 |\n| --- | --- |\n| x | y |\n\n---\n\nafter"
	out := BlocksToMarkdown(MarkdownToBlocks(md))

	if !strings.Contains(out, "| H1 | H2 |") {
		t.Errorf("round-trip lost table header:\n%s", out)
	}
	if !strings.Contains(out, "| --- | --- |") {
		t.Errorf("round-trip lost table separator:\n%s", out)
	}
	if !strings.Contains(out, "| x | y |") {
		t.Errorf("round-trip lost table row:\n%s", out)
	}
	if !strings.Contains(out, "---\n") && !strings.HasSuffix(strings.TrimSpace(out), "after") {
		t.Errorf("round-trip lost divider:\n%s", out)
	}
	if !strings.Contains(out, "after") {
		t.Errorf("round-trip lost trailing paragraph:\n%s", out)
	}
}

func TestMarkdownToBlocks_PipeParagraphNotTable(t *testing.T) {
	// A pipe-containing line NOT followed by a delimiter row stays a paragraph.
	blocks := MarkdownToBlocks("a | b | c")
	if len(blocks) != 1 || blocks[0].Type != blocktype.Paragraph {
		t.Fatalf("got %d blocks (type %q), want 1 paragraph", len(blocks), blocks[0].Type)
	}
}
