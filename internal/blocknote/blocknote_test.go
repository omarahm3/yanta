package blocknote

import (
	"encoding/json"
	"strings"
	"testing"
)

// inlineOf unmarshals a block's Content into []Inline for assertions.
func inlineOf(t *testing.T, b Block) []Inline {
	t.Helper()
	items, err := decodeInline(b.Content)
	if err != nil {
		t.Fatalf("decode content of %s block: %v", b.Type, err)
	}
	return items
}

func TestMarkdownToBlocks_Types(t *testing.T) {
	md := strings.Join([]string{
		"# Heading one",
		"",
		"## Heading two",
		"",
		"A paragraph.",
		"",
		"- bullet a",
		"- bullet b",
		"",
		"1. num a",
		"2. num b",
		"",
		"- [ ] todo",
		"- [x] done",
		"",
		"> a quote",
		"",
		"```go",
		`fmt.Println("hi")`,
		"```",
	}, "\n")

	blocks := MarkdownToBlocks(md)

	want := []struct {
		typ  string
		text string
	}{
		{"heading", "Heading one"},
		{"heading", "Heading two"},
		{"paragraph", "A paragraph."},
		{"bulletListItem", "bullet a"},
		{"bulletListItem", "bullet b"},
		{"numberedListItem", "num a"},
		{"numberedListItem", "num b"},
		{"checkListItem", "todo"},
		{"checkListItem", "done"},
		{"quote", "a quote"},
		{"codeBlock", `fmt.Println("hi")`},
	}

	if len(blocks) != len(want) {
		t.Fatalf("got %d blocks, want %d: %+v", len(blocks), len(want), blocks)
	}
	for i, w := range want {
		if blocks[i].Type != w.typ {
			t.Errorf("block %d: type = %q, want %q", i, blocks[i].Type, w.typ)
		}
		if got := plainText(blocks[i].Content); got != w.text {
			t.Errorf("block %d (%s): text = %q, want %q", i, blocks[i].Type, got, w.text)
		}
		if blocks[i].ID == "" {
			t.Errorf("block %d (%s): empty ID", i, blocks[i].Type)
		}
	}

	// Prop checks.
	if lvl := propInt(blocks[0].Props, "level", 0); lvl != 1 {
		t.Errorf("heading one level = %d, want 1", lvl)
	}
	if lvl := propInt(blocks[1].Props, "level", 0); lvl != 2 {
		t.Errorf("heading two level = %d, want 2", lvl)
	}
	if propBool(blocks[7].Props, "checked", true) != false {
		t.Errorf("todo should be unchecked")
	}
	if propBool(blocks[8].Props, "checked", false) != true {
		t.Errorf("done should be checked")
	}
	if lang := propString(blocks[10].Props, "language", ""); lang != "go" {
		t.Errorf("code block language = %q, want go", lang)
	}
}

func TestInlineStyles_Parse(t *testing.T) {
	blocks := MarkdownToBlocks("**bold** _italic_ `code` ~~strike~~ [text](https://ex.com)")
	if len(blocks) != 1 || blocks[0].Type != "paragraph" {
		t.Fatalf("expected 1 paragraph, got %+v", blocks)
	}
	items := inlineOf(t, blocks[0])

	// Find the styled text nodes and the link.
	var sawBold, sawItalic, sawCode, sawStrike, sawLink bool
	for _, it := range items {
		switch {
		case it.Type == "link":
			sawLink = true
			if it.Href != "https://ex.com" {
				t.Errorf("link href = %q", it.Href)
			}
			if got := inlineToMarkdown(it.Content); got != "text" {
				t.Errorf("link text = %q, want text", got)
			}
		case boolFrom(it.Styles, "bold") && it.Text == "bold":
			sawBold = true
		case boolFrom(it.Styles, "italic") && it.Text == "italic":
			sawItalic = true
		case boolFrom(it.Styles, "code") && it.Text == "code":
			sawCode = true
		case boolFrom(it.Styles, "strike") && it.Text == "strike":
			sawStrike = true
		}
	}
	if !sawBold || !sawItalic || !sawCode || !sawStrike || !sawLink {
		t.Errorf("missing styles: bold=%v italic=%v code=%v strike=%v link=%v\nitems=%+v",
			sawBold, sawItalic, sawCode, sawStrike, sawLink, items)
	}
}

func TestNestedStyle(t *testing.T) {
	// bold wrapping italic: both styles should land on the inner text node.
	blocks := MarkdownToBlocks("**bold _and italic_**")
	items := inlineOf(t, blocks[0])
	var found bool
	for _, it := range items {
		if it.Text == "and italic" && boolFrom(it.Styles, "bold") && boolFrom(it.Styles, "italic") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected a node with both bold+italic, got %+v", items)
	}
}

func TestStylesSerializeAsObjectNotNull(t *testing.T) {
	// BlockNote requires styles to be an object, never null.
	blocks := MarkdownToBlocks("plain text")
	data, err := json.Marshal(blocks)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), `"styles":null`) {
		t.Errorf("styles serialized as null; want {}:\n%s", data)
	}
	if !strings.Contains(string(data), `"styles":{}`) {
		t.Errorf("expected an empty styles object:\n%s", data)
	}
}

func TestEmptyInput(t *testing.T) {
	blocks := MarkdownToBlocks("")
	if blocks == nil {
		t.Fatal("MarkdownToBlocks(\"\") returned nil; want non-nil empty slice")
	}
	if len(blocks) != 0 {
		t.Errorf("got %d blocks, want 0", len(blocks))
	}
	data, _ := json.Marshal(blocks)
	if string(data) != "[]" {
		t.Errorf("empty blocks marshaled to %q, want []", data)
	}
}

func TestBlocksToMarkdown_Basic(t *testing.T) {
	md := BlocksToMarkdown(MarkdownToBlocks("# Title\n\nHello **world**"))
	for _, want := range []string{"# Title", "Hello **world**"} {
		if !strings.Contains(md, want) {
			t.Errorf("output missing %q:\n%s", want, md)
		}
	}
}

// TestRoundTripStable verifies the codec is a fixed point: converting Markdown
// to blocks and back yields output that is stable under a second pass.
func TestRoundTripStable(t *testing.T) {
	md := strings.Join([]string{
		"# Title",
		"",
		"A paragraph with **bold**, _italic_, `code`, and a [link](https://example.com).",
		"",
		"## Subheading",
		"",
		"- first",
		"- second",
		"",
		"1. one",
		"2. two",
		"",
		"- [ ] todo",
		"- [x] done",
		"",
		"> a quote",
		"",
		"```go",
		`fmt.Println("hi")`,
		"```",
	}, "\n")

	r1 := BlocksToMarkdown(MarkdownToBlocks(md))
	r2 := BlocksToMarkdown(MarkdownToBlocks(r1))

	if r1 != r2 {
		t.Errorf("round-trip not stable:\n--- r1 ---\n%s\n--- r2 ---\n%s", r1, r2)
	}

	for _, want := range []string{
		"# Title",
		"## Subheading",
		"**bold**", "_italic_", "`code`", "[link](https://example.com)",
		"- first", "1. one", "2. two",
		"- [ ] todo", "- [x] done",
		"> a quote",
		"```go", `fmt.Println("hi")`,
	} {
		if !strings.Contains(r1, want) {
			t.Errorf("round-trip output missing %q:\n%s", want, r1)
		}
	}
}

// TestBridgeShape confirms []Block marshals to JSON that unmarshals cleanly into
// a struct with document.BlockNoteBlock's exact shape (the MCP bridge relies on
// this).
func TestBridgeShape(t *testing.T) {
	type docBlock struct {
		ID       string          `json:"id"`
		Type     string          `json:"type"`
		Props    map[string]any  `json:"props,omitempty"`
		Content  json.RawMessage `json:"content,omitempty"`
		Children []docBlock      `json:"children,omitempty"`
	}

	blocks := MarkdownToBlocks("# H\n\ntext with `code`")
	data, err := json.Marshal(blocks)
	if err != nil {
		t.Fatal(err)
	}
	var got []docBlock
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("bridge unmarshal failed: %v", err)
	}
	if len(got) != len(blocks) {
		t.Fatalf("bridge length mismatch: %d vs %d", len(got), len(blocks))
	}
	for i := range got {
		if got[i].Type != blocks[i].Type || got[i].ID != blocks[i].ID {
			t.Errorf("bridge block %d mismatch: %+v vs %+v", i, got[i], blocks[i])
		}
	}
}
