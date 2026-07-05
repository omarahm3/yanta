package document

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestPropInt(t *testing.T) {
	props := map[string]any{"f": float64(3), "i": 2, "s": "x"}

	if got := PropInt(props, "f", 1); got != 3 {
		t.Errorf("float64: got %d, want 3", got)
	}
	if got := PropInt(props, "i", 1); got != 2 {
		t.Errorf("int: got %d, want 2", got)
	}
	if got := PropInt(props, "missing", 7); got != 7 {
		t.Errorf("missing key: got %d, want 7", got)
	}
	if got := PropInt(nil, "x", 5); got != 5 {
		t.Errorf("nil props: got %d, want 5", got)
	}
	if got := PropInt(props, "s", 9); got != 9 {
		t.Errorf("wrong type: got %d, want 9", got)
	}
}

func TestExtractPropText(t *testing.T) {
	if got := extractPropText(map[string]any{"caption": "hello", "name": "world"}); got != "hello world" {
		t.Errorf("got %q, want %q", got, "hello world")
	}
	if got := extractPropText(nil); got != "" {
		t.Errorf("nil: got %q, want empty", got)
	}
	if got := extractPropText(map[string]any{"other": 5}); got != "" {
		t.Errorf("no string props: got %q, want empty", got)
	}
}

// be.1: a content-less / unknown block type still contributes its prop text to FTS.
func TestParseUnknownBlockUsesPropText(t *testing.T) {
	p := NewParser()
	content := &ExtractedContent{}
	p.parseBlock(BlockNoteBlock{ID: "v1", Type: "video", Props: map[string]any{"caption": "my clip"}}, content)

	if !slicesContains(content.Body, "my clip") {
		t.Errorf("expected prop text in Body, got %v", content.Body)
	}
}

// be.5: heading level authored as a Go int (seed style, no JSON round-trip) still
// renders at the correct level instead of falling back to 1.
func TestMarkdownHeadingAcceptsIntLevel(t *testing.T) {
	m := NewMarkdownConverter()
	doc := &DocumentFile{
		Meta:   DocumentMeta{Project: "x", Title: "t", Created: time.Now(), Updated: time.Now()},
		Blocks: []BlockNoteBlock{{ID: "h", Type: "heading", Props: map[string]any{"level": 2}, Content: json.RawMessage(`[{"type":"text","text":"Hi","styles":{}}]`)}},
	}

	md, err := m.ToMarkdown(doc)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(md, "## Hi") {
		t.Errorf("expected '## Hi' for int level 2, got:\n%s", md)
	}
}

func slicesContains(s []string, v string) bool {
	for _, item := range s {
		if item == v {
			return true
		}
	}
	return false
}
