// Package blocknote converts between Markdown and Yanta's BlockNote document
// block model.
//
// It exists as a standalone package (rather than living in internal/document)
// so it stays free of the Wails/GTK4 build chain and can be unit-tested
// headlessly. Its Block and Inline types mirror document.BlockNoteBlock and
// document.BlockNoteContent field-for-field and tag-for-tag, so a []Block
// marshals to JSON that unmarshals losslessly into []document.BlockNoteBlock
// (and vice-versa). The MCP layer bridges the two with a single json round-trip.
//
// The conversion targets the block types Yanta actually renders (see
// internal/export/renderer.go): heading, paragraph, codeBlock, bulletListItem,
// numberedListItem, checkListItem, quote, image, file, table; and the inline
// styles bold, italic, code, strike plus links. It is intentionally a pragmatic
// subset aimed at agent-authored content, not a full CommonMark implementation.
// Notably: nested lists are flattened on the Markdown->blocks path, and
// multi-line paragraphs are joined with a single space (Markdown soft-break
// semantics).
package blocknote

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"yanta/internal/blocktype"

	"github.com/google/uuid"
)

// Block mirrors document.BlockNoteBlock's JSON shape.
type Block struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`
	Props    map[string]any  `json:"props,omitempty"`
	Content  json.RawMessage `json:"content,omitempty"`
	Children []Block         `json:"children,omitempty"`
}

// Inline mirrors document.BlockNoteContent's JSON shape. Styles has no
// omitempty on purpose: BlockNote expects an object ({}), never null.
type Inline struct {
	Type    string         `json:"type"`
	Text    string         `json:"text,omitempty"`
	Styles  map[string]any `json:"styles"`
	Href    string         `json:"href,omitempty"`
	Content []Inline       `json:"content,omitempty"`
}

var (
	headingRe = regexp.MustCompile(`^(#{1,6})\s+(.*)$`)
	checkRe   = regexp.MustCompile(`^[-*]\s+\[([ xX])\]\s+(.*)$`)
	bulletRe  = regexp.MustCompile(`^[-*]\s+(.*)$`)
	numRe     = regexp.MustCompile(`^(\d+)\.\s+(.*)$`)
)

// MarkdownToBlocks parses Markdown into BlockNote blocks. It always returns a
// non-nil slice (empty for empty input) so it satisfies BlockNote's "blocks
// cannot be nil" invariant when marshaled into a document.
func MarkdownToBlocks(md string) []Block {
	lines := strings.Split(strings.ReplaceAll(md, "\r\n", "\n"), "\n")
	blocks := []Block{}

	var para []string
	flushPara := func() {
		if len(para) == 0 {
			return
		}
		blocks = append(blocks, inlineBlock(blocktype.Paragraph, nil, strings.Join(para, " ")))
		para = nil
	}

	for i := 0; i < len(lines); {
		line := strings.TrimSpace(lines[i])

		switch {
		case strings.HasPrefix(line, "```"):
			flushPara()
			lang := strings.TrimSpace(line[3:])
			i++
			var code []string
			for i < len(lines) && !strings.HasPrefix(strings.TrimSpace(lines[i]), "```") {
				code = append(code, lines[i])
				i++
			}
			if i < len(lines) { // consume closing fence
				i++
			}
			blocks = append(blocks, codeBlock(lang, strings.Join(code, "\n")))

		case line == "":
			flushPara()
			i++

		case headingRe.MatchString(line):
			flushPara()
			m := headingRe.FindStringSubmatch(line)
			level := len(m[1])
			if level > 3 { // BlockNote headings support levels 1-3
				level = 3
			}
			blocks = append(blocks, inlineBlock(blocktype.Heading, map[string]any{"level": level}, m[2]))
			i++

		case strings.HasPrefix(line, ">"):
			flushPara()
			var q []string
			for i < len(lines) {
				t := strings.TrimSpace(lines[i])
				if !strings.HasPrefix(t, ">") {
					break
				}
				q = append(q, strings.TrimSpace(strings.TrimPrefix(t, ">")))
				i++
			}
			blocks = append(blocks, inlineBlock(blocktype.Quote, nil, strings.Join(q, " ")))

		case checkRe.MatchString(line): // must precede bulletRe
			flushPara()
			m := checkRe.FindStringSubmatch(line)
			checked := m[1] == "x" || m[1] == "X"
			blocks = append(blocks, inlineBlock(blocktype.CheckListItem, map[string]any{"checked": checked}, m[2]))
			i++

		case bulletRe.MatchString(line):
			flushPara()
			m := bulletRe.FindStringSubmatch(line)
			blocks = append(blocks, inlineBlock(blocktype.BulletListItem, nil, m[1]))
			i++

		case numRe.MatchString(line):
			flushPara()
			m := numRe.FindStringSubmatch(line)
			blocks = append(blocks, inlineBlock(blocktype.NumberedListItem, nil, m[2]))
			i++

		default:
			para = append(para, line)
			i++
		}
	}
	flushPara()
	return blocks
}

// BlocksToMarkdown renders BlockNote blocks back to Markdown.
func BlocksToMarkdown(blocks []Block) string {
	var b strings.Builder
	renderBlocks(&b, blocks, 0)
	return strings.TrimRight(b.String(), "\n")
}

func renderBlocks(b *strings.Builder, blocks []Block, depth int) {
	indent := strings.Repeat("  ", depth)
	num := 0
	for _, blk := range blocks {
		if blk.Type != blocktype.NumberedListItem {
			num = 0
		}
		switch blk.Type {
		case blocktype.Heading:
			level := propInt(blk.Props, "level", 1)
			if level < 1 {
				level = 1
			} else if level > 3 {
				level = 3
			}
			fmt.Fprintf(b, "%s%s %s\n\n", indent, strings.Repeat("#", level), renderInline(blk.Content))
		case blocktype.Paragraph:
			if t := renderInline(blk.Content); t != "" {
				fmt.Fprintf(b, "%s%s\n\n", indent, t)
			}
		case blocktype.CodeBlock:
			fmt.Fprintf(b, "%s```%s\n%s\n```\n\n", indent, propString(blk.Props, "language", ""), plainText(blk.Content))
		case blocktype.BulletListItem:
			fmt.Fprintf(b, "%s- %s\n", indent, renderInline(blk.Content))
		case blocktype.NumberedListItem:
			num++
			fmt.Fprintf(b, "%s%d. %s\n", indent, num, renderInline(blk.Content))
		case blocktype.CheckListItem:
			mark := " "
			if propBool(blk.Props, "checked", false) {
				mark = "x"
			}
			fmt.Fprintf(b, "%s- [%s] %s\n", indent, mark, renderInline(blk.Content))
		case blocktype.Quote:
			fmt.Fprintf(b, "%s> %s\n\n", indent, renderInline(blk.Content))
		case blocktype.Image:
			fmt.Fprintf(b, "%s![%s](%s)\n\n", indent, propString(blk.Props, "caption", ""), propString(blk.Props, "url", ""))
		case blocktype.File:
			url := propString(blk.Props, "url", "")
			fmt.Fprintf(b, "%s[%s](%s)\n\n", indent, propString(blk.Props, "name", url), url)
		case blocktype.Table:
			renderTable(b, indent, blk.Content)
		default:
			if t := renderInline(blk.Content); t != "" {
				fmt.Fprintf(b, "%s%s\n\n", indent, t)
			}
		}
		if len(blk.Children) > 0 {
			renderBlocks(b, blk.Children, depth+1)
		}
	}
}

// --- block builders ---

func inlineBlock(typ string, props map[string]any, text string) Block {
	return Block{
		ID:      uuid.NewString(),
		Type:    typ,
		Props:   props,
		Content: marshalInline(parseInline(text)),
	}
}

func codeBlock(lang, code string) Block {
	return Block{
		ID:      uuid.NewString(),
		Type:    blocktype.CodeBlock,
		Props:   map[string]any{"language": lang},
		Content: marshalInline([]Inline{{Type: "text", Text: code, Styles: map[string]any{}}}),
	}
}

func marshalInline(items []Inline) json.RawMessage {
	if items == nil {
		items = []Inline{}
	}
	data, err := json.Marshal(items)
	if err != nil {
		return json.RawMessage("[]")
	}
	return json.RawMessage(data)
}

// --- inline parsing (Markdown -> []Inline) ---

func parseInline(s string) []Inline {
	out := []Inline{}
	var buf strings.Builder
	flush := func() {
		if buf.Len() > 0 {
			out = append(out, Inline{Type: "text", Text: buf.String(), Styles: map[string]any{}})
			buf.Reset()
		}
	}

	for i := 0; i < len(s); {
		switch {
		case s[i] == '`':
			if end := strings.IndexByte(s[i+1:], '`'); end >= 0 {
				flush()
				out = append(out, Inline{Type: "text", Text: s[i+1 : i+1+end], Styles: map[string]any{"code": true}})
				i += end + 2
				continue
			}
		case s[i] == '[':
			if label, url, n, ok := matchLink(s[i:]); ok {
				flush()
				out = append(out, Inline{Type: "link", Href: url, Content: parseInline(label)})
				i += n
				continue
			}
		case strings.HasPrefix(s[i:], "**"):
			if inner, n, ok := matchDelim(s[i:], "**"); ok {
				flush()
				out = append(out, applyStyle(parseInline(inner), "bold")...)
				i += n
				continue
			}
		case strings.HasPrefix(s[i:], "~~"):
			if inner, n, ok := matchDelim(s[i:], "~~"); ok {
				flush()
				out = append(out, applyStyle(parseInline(inner), "strike")...)
				i += n
				continue
			}
		case s[i] == '*' || s[i] == '_':
			if inner, n, ok := matchDelim(s[i:], string(s[i])); ok {
				flush()
				out = append(out, applyStyle(parseInline(inner), "italic")...)
				i += n
				continue
			}
		}
		buf.WriteByte(s[i])
		i++
	}
	flush()
	return out
}

// matchDelim matches s[0:] against a balanced pair of delim, returning the inner
// text, the number of bytes consumed, and whether a non-empty match was found.
func matchDelim(s, delim string) (string, int, bool) {
	if !strings.HasPrefix(s, delim) {
		return "", 0, false
	}
	rest := s[len(delim):]
	idx := strings.Index(rest, delim)
	if idx <= 0 { // no close, or empty inner
		return "", 0, false
	}
	return rest[:idx], len(delim)*2 + idx, true
}

// matchLink matches a `[label](url)` link at the start of s.
func matchLink(s string) (label, url string, n int, ok bool) {
	closeB := strings.IndexByte(s, ']')
	if closeB < 1 || closeB+1 >= len(s) || s[closeB+1] != '(' {
		return "", "", 0, false
	}
	rest := s[closeB+2:]
	closeP := strings.IndexByte(rest, ')')
	if closeP < 0 {
		return "", "", 0, false
	}
	return s[1:closeB], rest[:closeP], closeB + 2 + closeP + 1, true
}

func applyStyle(items []Inline, style string) []Inline {
	for i := range items {
		switch items[i].Type {
		case "text":
			if items[i].Styles == nil {
				items[i].Styles = map[string]any{}
			}
			items[i].Styles[style] = true
		case "link":
			items[i].Content = applyStyle(items[i].Content, style)
		}
	}
	return items
}

// --- inline rendering ([]Inline -> Markdown) ---

func renderInline(raw json.RawMessage) string {
	items, err := decodeInline(raw)
	if err != nil {
		return ""
	}
	return inlineToMarkdown(items)
}

func inlineToMarkdown(items []Inline) string {
	var sb strings.Builder
	for _, it := range items {
		switch it.Type {
		case "text":
			sb.WriteString(styleWrap(it.Text, it.Styles))
		case "link":
			sb.WriteString("[" + inlineToMarkdown(it.Content) + "](" + it.Href + ")")
		}
	}
	return sb.String()
}

// styleWrap wraps text with Markdown markers. Order matters for round-tripping:
// code innermost, then strike, italic, and bold outermost.
func styleWrap(text string, styles map[string]any) string {
	t := text
	if boolFrom(styles, blocktype.StyleCode) {
		t = "`" + t + "`"
	}
	if boolFrom(styles, blocktype.StyleStrike) {
		t = "~~" + t + "~~"
	}
	if boolFrom(styles, blocktype.StyleItalic) {
		t = "_" + t + "_"
	}
	if boolFrom(styles, blocktype.StyleBold) {
		t = "**" + t + "**"
	}
	return t
}

func plainText(raw json.RawMessage) string {
	items, err := decodeInline(raw)
	if err != nil {
		return ""
	}
	var sb strings.Builder
	var walk func([]Inline)
	walk = func(items []Inline) {
		for _, it := range items {
			if it.Type == "text" {
				sb.WriteString(it.Text)
			}
			if len(it.Content) > 0 {
				walk(it.Content)
			}
		}
	}
	walk(items)
	return sb.String()
}

func renderTable(b *strings.Builder, indent string, raw json.RawMessage) {
	var tc struct {
		Rows []struct {
			Cells []struct {
				Content []Inline `json:"content"`
			} `json:"cells"`
		} `json:"rows"`
	}
	if err := json.Unmarshal(raw, &tc); err != nil || len(tc.Rows) == 0 {
		return
	}
	for ri, row := range tc.Rows {
		cells := make([]string, 0, len(row.Cells))
		for _, c := range row.Cells {
			cells = append(cells, inlineToMarkdown(c.Content))
		}
		fmt.Fprintf(b, "%s| %s |\n", indent, strings.Join(cells, " | "))
		if ri == 0 {
			seps := make([]string, len(cells))
			for i := range seps {
				seps[i] = "---"
			}
			fmt.Fprintf(b, "%s| %s |\n", indent, strings.Join(seps, " | "))
		}
	}
	b.WriteString("\n")
}

// --- helpers ---

func decodeInline(raw json.RawMessage) ([]Inline, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var items []Inline
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func propInt(props map[string]any, key string, def int) int {
	if props == nil {
		return def
	}
	switch v := props[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return def
}

func propString(props map[string]any, key, def string) string {
	if props == nil {
		return def
	}
	if s, ok := props[key].(string); ok {
		return s
	}
	return def
}

func propBool(props map[string]any, key string, def bool) bool {
	if props == nil {
		return def
	}
	if v, ok := props[key].(bool); ok {
		return v
	}
	return def
}

func boolFrom(styles map[string]any, key string) bool {
	if styles == nil {
		return false
	}
	v, _ := styles[key].(bool)
	return v
}
