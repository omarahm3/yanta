package document

import (
	"encoding/json"
	"net/url"
	"strings"
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
	case "heading":
		p.parseHeading(block, content)
	case "paragraph":
		p.parseParagraph(block, content)
	case "codeBlock":
		p.parseCodeBlock(block, content)
	case "bulletListItem", "numberedListItem", "checkListItem":
		p.parseListItem(block, content)
	case "image":
		p.parseImage(block, content)
	case "file":
		p.parseFile(block, content)
	case "quote":
		p.parseQuote(block, content)
	case "table":
		p.parseTable(block, content)
	default:
		text := p.extractTextFromContent(block.Content)
		if text != "" {
			content.Body = append(content.Body, text)
		}
	}

	for _, child := range block.Children {
		p.parseBlock(child, content)
	}
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
		case "text":
			if item.Text != "" {
				parts = append(parts, item.Text)
			}
		case "link":
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
		case "text":
			if item.Text != "" {
				parts = append(parts, item.Text)
			}
		case "link":
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
		if item.Type == "link" && item.Href != "" {
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
