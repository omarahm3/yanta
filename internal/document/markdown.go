package document

import (
	"encoding/json"
	"fmt"
	"strings"
)

type MarkdownConverter struct{}

func NewMarkdownConverter() *MarkdownConverter {
	return &MarkdownConverter{}
}

func (m *MarkdownConverter) ToMarkdown(doc *DocumentFile) (string, error) {
	var lines []string

	for _, block := range doc.Blocks {
		m.convertBlock(block, &lines, 0)
	}

	return strings.Join(lines, "\n"), nil
}

func (m *MarkdownConverter) convertBlock(block BlockNoteBlock, lines *[]string, depth int) {
	switch block.Type {
	case "heading":
		m.convertHeading(block, lines)
	case "paragraph":
		m.convertParagraph(block, lines)
	case "codeBlock":
		m.convertCodeBlock(block, lines)
	case "bulletListItem":
		m.convertBulletListItem(block, lines, depth)
	case "numberedListItem":
		m.convertNumberedListItem(block, lines, depth)
	case "checkListItem":
		m.convertCheckListItem(block, lines, depth)
	case "image":
		m.convertImage(block, lines)
	case "file":
		m.convertFile(block, lines)
	case "quote":
		m.convertQuote(block, lines)
	case "table":
		m.convertTable(block, lines)
	default:
		text := m.extractFormattedText(block.Content)
		if text != "" {
			*lines = append(*lines, text)
		}
	}

	for _, child := range block.Children {
		m.convertBlock(child, lines, depth+1)
	}
}

func (m *MarkdownConverter) extractFormattedText(rawContent json.RawMessage) string {
	if len(rawContent) == 0 {
		return ""
	}

	var inlineContent []BlockNoteContent
	if err := json.Unmarshal(rawContent, &inlineContent); err != nil {
		return ""
	}

	return m.formatInlineContent(inlineContent)
}

func (m *MarkdownConverter) formatInlineContent(inlineContent []BlockNoteContent) string {
	var parts []string
	for _, item := range inlineContent {
		switch item.Type {
		case "text":
			if item.Text != "" {
				parts = append(parts, m.formatTextWithStyles(item.Text, item.Styles))
			}
		case "link":
			if len(item.Content) > 0 {
				linkText := m.formatInlineContent(item.Content)
				if linkText != "" {
					parts = append(parts, fmt.Sprintf("[%s](%s)", linkText, item.Href))
				}
			}
		}
	}
	return strings.Join(parts, "")
}

func (m *MarkdownConverter) formatTextWithStyles(text string, styles map[string]any) string {
	if styles == nil {
		return text
	}

	result := text

	if bold, ok := styles["bold"].(bool); ok && bold {
		result = "**" + result + "**"
	}

	if italic, ok := styles["italic"].(bool); ok && italic {
		result = "*" + result + "*"
	}

	if code, ok := styles["code"].(bool); ok && code {
		result = "`" + result + "`"
	}

	if strike, ok := styles["strike"].(bool); ok && strike {
		result = "~~" + result + "~~"
	}

	return result
}

func (m *MarkdownConverter) convertHeading(block BlockNoteBlock, lines *[]string) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	level := 1
	if block.Props != nil {
		if lvl, ok := block.Props["level"].(float64); ok {
			level = int(lvl)
		}
	}

	prefix := strings.Repeat("#", level)
	*lines = append(*lines, "", fmt.Sprintf("%s %s", prefix, text))
}

func (m *MarkdownConverter) convertParagraph(block BlockNoteBlock, lines *[]string) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	*lines = append(*lines, "", text)
}

func (m *MarkdownConverter) convertCodeBlock(block BlockNoteBlock, lines *[]string) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	language := ""
	if block.Props != nil {
		if lang, ok := block.Props["language"].(string); ok {
			language = lang
		}
	}

	*lines = append(*lines, "", fmt.Sprintf("```%s", language))
	*lines = append(*lines, text)
	*lines = append(*lines, "```")
}

func (m *MarkdownConverter) convertBulletListItem(block BlockNoteBlock, lines *[]string, depth int) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	indent := strings.Repeat("  ", depth)
	*lines = append(*lines, fmt.Sprintf("%s- %s", indent, text))
}

func (m *MarkdownConverter) convertNumberedListItem(block BlockNoteBlock, lines *[]string, depth int) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	indent := strings.Repeat("  ", depth)
	*lines = append(*lines, fmt.Sprintf("%s1. %s", indent, text))
}

func (m *MarkdownConverter) convertCheckListItem(block BlockNoteBlock, lines *[]string, depth int) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	checked := false
	if block.Props != nil {
		if chk, ok := block.Props["checked"].(bool); ok {
			checked = chk
		}
	}

	checkbox := "[ ]"
	if checked {
		checkbox = "[x]"
	}

	indent := strings.Repeat("  ", depth)
	*lines = append(*lines, fmt.Sprintf("%s- %s %s", indent, checkbox, text))
}

func (m *MarkdownConverter) convertImage(block BlockNoteBlock, lines *[]string) {
	props := block.Props
	if props == nil {
		return
	}

	url, ok := props["url"].(string)
	if !ok || url == "" {
		return
	}

	caption := ""
	if cap, ok := props["caption"].(string); ok {
		caption = cap
	}

	*lines = append(*lines, "", fmt.Sprintf("![%s](%s)", caption, url))
}

func (m *MarkdownConverter) convertFile(block BlockNoteBlock, lines *[]string) {
	props := block.Props
	if props == nil {
		return
	}

	url, ok := props["url"].(string)
	if !ok || url == "" {
		return
	}

	name := "file"
	if n, ok := props["name"].(string); ok && n != "" {
		name = n
	}

	*lines = append(*lines, "", fmt.Sprintf("[%s](%s)", name, url))
}

func (m *MarkdownConverter) convertQuote(block BlockNoteBlock, lines *[]string) {
	text := m.extractFormattedText(block.Content)
	if text == "" {
		return
	}

	*lines = append(*lines, "", fmt.Sprintf("> %s", text))
}

func (m *MarkdownConverter) convertTable(block BlockNoteBlock, lines *[]string) {
	if len(block.Content) == 0 {
		return
	}

	var table tableContent
	if err := json.Unmarshal(block.Content, &table); err != nil {
		return
	}

	if len(table.Rows) == 0 {
		return
	}

	*lines = append(*lines, "")

	for i, row := range table.Rows {
		var cells []string
		for _, cell := range row.Cells {
			text := m.formatInlineContent(cell.Content)
			cells = append(cells, text)
		}
		*lines = append(*lines, "| "+strings.Join(cells, " | ")+" |")

		if i == 0 {
			separator := make([]string, len(cells))
			for j := range separator {
				separator[j] = "---"
			}
			*lines = append(*lines, "| "+strings.Join(separator, " | ")+" |")
		}
	}
}
