package document

import (
	"encoding/json"
	"strings"
)

func (p *Parser) parseHeading(block BlockNoteBlock, content *ExtractedContent) {
	text := p.extractTextFromContent(block.Content)
	if text == "" {
		return
	}

	content.Headings = append(content.Headings, text)

	links := p.extractLinksFromContent(block.Content)
	content.Links = append(content.Links, links...)
}

func (p *Parser) parseParagraph(block BlockNoteBlock, content *ExtractedContent) {
	text := p.extractTextFromContent(block.Content)
	if text == "" {
		return
	}

	content.Body = append(content.Body, text)

	links := p.extractLinksFromContent(block.Content)
	content.Links = append(content.Links, links...)
}

func (p *Parser) parseCodeBlock(block BlockNoteBlock, content *ExtractedContent) {
	text := p.extractTextFromContent(block.Content)
	if text == "" {
		return
	}

	content.Code = append(content.Code, text)
}

func (p *Parser) parseListItem(block BlockNoteBlock, content *ExtractedContent) {
	text := p.extractTextFromContent(block.Content)
	if text == "" {
		return
	}

	content.Body = append(content.Body, text)

	links := p.extractLinksFromContent(block.Content)
	content.Links = append(content.Links, links...)
}

func (p *Parser) parseImage(block BlockNoteBlock, content *ExtractedContent) {
	props := block.Props
	if props == nil {
		return
	}

	url, ok := props["url"].(string)
	if !ok || url == "" {
		return
	}

	asset := Asset{
		Path: url,
	}

	if caption, ok := props["caption"].(string); ok {
		asset.Caption = caption
		if caption != "" {
			content.Body = append(content.Body, caption)
		}
	}

	content.Assets = append(content.Assets, asset)
}

func (p *Parser) parseFile(block BlockNoteBlock, content *ExtractedContent) {
	props := block.Props
	if props == nil {
		return
	}

	url, ok := props["url"].(string)
	if !ok || url == "" {
		return
	}

	asset := Asset{
		Path: url,
	}

	if name, ok := props["name"].(string); ok && name != "" {
		asset.Caption = name
		content.Body = append(content.Body, name)
	}

	content.Assets = append(content.Assets, asset)
}

func (p *Parser) parseQuote(block BlockNoteBlock, content *ExtractedContent) {
	text := p.extractTextFromContent(block.Content)
	if text == "" {
		return
	}

	content.Body = append(content.Body, text)

	links := p.extractLinksFromContent(block.Content)
	content.Links = append(content.Links, links...)
}

type tableContent struct {
	Type         string `json:"type"`
	ColumnWidths []any  `json:"columnWidths"`
	Rows         []struct {
		Cells []struct {
			Type    string             `json:"type"`
			Content []BlockNoteContent `json:"content"`
			Props   map[string]any     `json:"props"`
		} `json:"cells"`
	} `json:"rows"`
}

func (p *Parser) parseTable(block BlockNoteBlock, content *ExtractedContent) {
	if len(block.Content) == 0 {
		return
	}

	var table tableContent
	if err := json.Unmarshal(block.Content, &table); err != nil {
		return
	}

	var tableText []string
	for _, row := range table.Rows {
		for _, cell := range row.Cells {
			text := p.extractTextFromContentSlice(cell.Content)
			if text != "" {
				tableText = append(tableText, text)
			}
		}
	}

	if len(tableText) > 0 {
		content.Body = append(content.Body, strings.Join(tableText, " "))
	}
}
