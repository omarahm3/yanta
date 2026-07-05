package document

import (
	"encoding/json"
	"net/url"
	"strings"

	"yanta/internal/blocktype"
)

type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) Parse(doc *DocumentFile) (*ExtractedContent, error) {
	content := &ExtractedContent{
		Title:    doc.Meta.Title,
		Headings: []string{},
		Body:     []string{},
		Code:     []string{},
		Links:    []Link{},
		Assets:   []Asset{},
	}

	for _, block := range doc.Blocks {
		p.parseBlock(block, content)
	}

	if content.Title == "" && len(content.Headings) > 0 {
		content.Title = content.Headings[0]
	}

	content.HasCode = len(content.Code) > 0
	content.HasImages = len(content.Assets) > 0
	content.HasLinks = len(content.Links) > 0

	return content, nil
}

func (p *Parser) parseBlock(block BlockNoteBlock, content *ExtractedContent) {
	switch block.Type {
	case blocktype.Heading:
		p.parseHeading(block, content)
	case blocktype.Paragraph:
		p.parseParagraph(block, content)
	case blocktype.CodeBlock:
		p.parseCodeBlock(block, content)
	case blocktype.BulletListItem, blocktype.NumberedListItem, blocktype.CheckListItem:
		p.parseListItem(block, content)
	case blocktype.Image:
		p.parseImage(block, content)
	case blocktype.File:
		p.parseFile(block, content)
	case blocktype.Quote:
		p.parseQuote(block, content)
	case blocktype.Table:
		p.parseTable(block, content)
	default:
		text := p.extractTextFromContent(block.Content)
		if text == "" {
			text = extractPropText(block.Props)
		}
		if text != "" {
			content.Body = append(content.Body, text)
		}
	}

	for _, child := range block.Children {
		p.parseBlock(child, content)
	}
}

// extractPropText pulls searchable text from a block's props for block types
// that carry their payload in props rather than an inline content array (future
// video/audio/embed or plugin blocks). Without it such blocks contribute nothing
// to FTS and are silently unsearchable.
func extractPropText(props map[string]any) string {
	if props == nil {
		return ""
	}
	var parts []string
	for _, key := range []string{"text", "caption", "name", "title", "alt", "url"} {
		if v, ok := props[key].(string); ok {
			if trimmed := strings.TrimSpace(v); trimmed != "" {
				parts = append(parts, trimmed)
			}
		}
	}
	return strings.Join(parts, " ")
}

func (p *Parser) extractTextFromContent(rawContent json.RawMessage) string {
	if len(rawContent) == 0 {
		return ""
	}

	var inlineContent []BlockNoteContent
	if err := json.Unmarshal(rawContent, &inlineContent); err != nil {
		return ""
	}

	var parts []string
	for _, item := range inlineContent {
		switch item.Type {
		case blocktype.InlineText:
			if item.Text != "" {
				parts = append(parts, item.Text)
			}
		case blocktype.InlineLink:
			if len(item.Content) > 0 {
				nestedText := p.extractTextFromContentSlice(item.Content)
				if nestedText != "" {
					parts = append(parts, nestedText)
				}
			}
		}
	}

	return strings.Join(parts, "")
}

func (p *Parser) extractTextFromContentSlice(inlineContent []BlockNoteContent) string {
	var parts []string
	for _, item := range inlineContent {
		switch item.Type {
		case blocktype.InlineText:
			if item.Text != "" {
				parts = append(parts, item.Text)
			}
		case blocktype.InlineLink:
			if len(item.Content) > 0 {
				nestedText := p.extractTextFromContentSlice(item.Content)
				if nestedText != "" {
					parts = append(parts, nestedText)
				}
			}
		}
	}
	return strings.Join(parts, "")
}

func (p *Parser) extractLinksFromContent(rawContent json.RawMessage) []Link {
	if len(rawContent) == 0 {
		return nil
	}

	var inlineContent []BlockNoteContent
	if err := json.Unmarshal(rawContent, &inlineContent); err != nil {
		return nil
	}

	var links []Link
	for _, item := range inlineContent {
		if item.Type == blocktype.InlineLink && item.Href != "" {
			link := Link{
				URL:  item.Href,
				Host: p.extractHost(item.Href),
			}
			links = append(links, link)
		}
	}

	return links
}

func (p *Parser) extractHost(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.Host
}
