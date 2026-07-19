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

	kind := doc.Kind
	if kind == "" {
		kind = DocumentKindDocument
	}

	switch kind {
	case DocumentKindCanvas:
		p.parseCanvas(doc, content)
	case DocumentKindDocument:
		for _, block := range doc.Blocks {
			p.parseBlock(block, content)
		}
	}

	if content.Title == "" && len(content.Headings) > 0 {
		content.Title = content.Headings[0]
	}

	content.HasCode = len(content.Code) > 0
	content.HasImages = len(content.Assets) > 0
	content.HasLinks = len(content.Links) > 0

	return content, nil
}

func (p *Parser) parseCanvas(doc *DocumentFile, content *ExtractedContent) {
	content.Body = append(content.Body, extractCanvasText(doc.Scene)...)

	// Extract asset references from the Assets map
	for _, ref := range doc.Assets {
		if ref != "" {
			content.Assets = append(content.Assets, Asset{Path: ref})
		}
	}
}

// maxCanvasSceneBytes caps the scene JSON we'll parse for text extraction. A
// scene larger than this is almost certainly dominated by inline image data;
// skip text extraction rather than scan it (the doc is still indexed by title).
const maxCanvasSceneBytes = 20 * 1024 * 1024

// extractCanvasText returns the text of every text element in an Excalidraw
// scene, in document order. It decodes into a minimal typed struct so the
// scene's `files` blob (potentially large inline base64) is scanned-and-skipped
// rather than materialized into memory the way a map[string]any would.
func extractCanvasText(scene json.RawMessage) []string {
	if len(scene) == 0 || len(scene) > maxCanvasSceneBytes {
		return nil
	}

	var parsed struct {
		Elements []struct {
			Type      string `json:"type"`
			Text      string `json:"text"`
			IsDeleted bool   `json:"isDeleted"`
		} `json:"elements"`
	}
	if err := json.Unmarshal(scene, &parsed); err != nil {
		return nil
	}

	var out []string
	for _, el := range parsed.Elements {
		// Excalidraw soft-deletes elements by flagging isDeleted rather than
		// removing them; skip those so removed text stays out of the search
		// index and the markdown export.
		if el.IsDeleted {
			continue
		}
		if el.Type == "text" && el.Text != "" {
			out = append(out, el.Text)
		}
	}
	return out
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
