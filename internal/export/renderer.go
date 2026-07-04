package export

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"yanta/internal/blocktype"
	"yanta/internal/document"
	"yanta/internal/logger"
)

type Renderer struct {
	pdf          *PDF
	vault        VaultProvider
	projectAlias string
}

func NewRenderer(pdf *PDF, vault VaultProvider, projectAlias string) *Renderer {
	return &Renderer{
		pdf:          pdf,
		vault:        vault,
		projectAlias: projectAlias,
	}
}

// RenderBlocks renders a sibling sequence. Numbered-list numbering is scoped to
// the sequence and restarts whenever a non-numbered block breaks the run, so
// two separate numbered lists both start at 1 and nested lists get their own
// numbering (children are rendered as their own sequence).
func (r *Renderer) RenderBlocks(blocks []document.BlockNoteBlock) error {
	listNumber := 0
	for _, block := range blocks {
		if block.Type == blocktype.NumberedListItem {
			listNumber++
		} else {
			listNumber = 0
		}
		if err := r.renderBlock(block, listNumber); err != nil {
			return err
		}
	}
	return nil
}

// RenderBlock renders a single block (and its children) as a standalone
// sequence.
func (r *Renderer) RenderBlock(block document.BlockNoteBlock) error {
	return r.RenderBlocks([]document.BlockNoteBlock{block})
}

func (r *Renderer) renderBlock(block document.BlockNoteBlock, listNumber int) error {
	switch block.Type {
	case blocktype.Heading:
		if err := r.renderHeading(block); err != nil {
			return err
		}
	case blocktype.Paragraph:
		if err := r.renderParagraph(block); err != nil {
			return err
		}
	case blocktype.CodeBlock:
		if err := r.renderCodeBlock(block); err != nil {
			return err
		}
	case blocktype.BulletListItem:
		if err := r.renderBulletListItem(block); err != nil {
			return err
		}
	case blocktype.NumberedListItem:
		if err := r.renderNumberedListItem(block, listNumber); err != nil {
			return err
		}
	case blocktype.CheckListItem:
		if err := r.renderCheckListItem(block); err != nil {
			return err
		}
	case blocktype.Image:
		if err := r.renderImage(block); err != nil {
			return err
		}
	case blocktype.File:
		if err := r.renderFile(block); err != nil {
			return err
		}
	case blocktype.Quote:
		if err := r.renderQuote(block); err != nil {
			return err
		}
	case blocktype.Table:
		if err := r.renderTable(block); err != nil {
			return err
		}
	default:
		// For unknown block types, try to extract text
		text := r.extractTextFromBlock(block)
		if text != "" {
			r.pdf.AddParagraph(text)
		}
	}

	return r.RenderBlocks(block.Children)
}

func (r *Renderer) renderHeading(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	level := document.PropInt(block.Props, "level", 1)

	r.pdf.AddHeading(level, text)
	return nil
}

func (r *Renderer) renderParagraph(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	r.pdf.AddParagraph(text)
	return nil
}

func (r *Renderer) renderCodeBlock(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	language := ""
	if block.Props != nil {
		if lang, ok := block.Props["language"].(string); ok {
			language = lang
		}
	}

	r.pdf.AddCodeBlock(text, language)
	return nil
}

func (r *Renderer) renderBulletListItem(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	r.pdf.AddListItem(text, false, 0)
	return nil
}

func (r *Renderer) renderNumberedListItem(block document.BlockNoteBlock, number int) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	r.pdf.AddListItem(text, true, number)
	return nil
}

func (r *Renderer) renderCheckListItem(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	checked := false
	if block.Props != nil {
		if chk, ok := block.Props["checked"].(bool); ok {
			checked = chk
		}
	}

	prefix := "☐"
	if checked {
		prefix = "☑"
	}

	r.pdf.AddListItem(fmt.Sprintf("%s %s", prefix, text), false, 0)
	return nil
}

func (r *Renderer) renderImage(block document.BlockNoteBlock) error {
	if block.Props == nil {
		return nil
	}

	url, ok := block.Props["url"].(string)
	if !ok || url == "" {
		return nil
	}

	caption := ""
	if cap, ok := block.Props["caption"].(string); ok {
		caption = cap
	}

	// Extract hash and extension from URL
	// Expected format: /assets/{project}/{hash}{ext}
	imagePath, err := r.resolveImagePath(url)
	if err != nil {
		logger.WithError(err).WithField("url", url).Warn("failed to resolve image path, skipping")
		return nil
	}

	// Check if image file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		logger.WithField("path", imagePath).Warn("image file not found, skipping")
		return nil
	}

	if err := r.pdf.AddImage(imagePath, caption); err != nil {
		logger.WithError(err).WithField("path", imagePath).Warn("failed to add image to PDF")
		return nil
	}

	return nil
}

func (r *Renderer) renderFile(block document.BlockNoteBlock) error {
	if block.Props == nil {
		return nil
	}

	url, ok := block.Props["url"].(string)
	if !ok || url == "" {
		return nil
	}

	name := ""
	if n, ok := block.Props["name"].(string); ok && n != "" {
		name = n
	}

	// Render file as a paragraph with name and URL
	if name != "" {
		r.pdf.AddParagraph(fmt.Sprintf("📎 %s (%s)", name, url))
	} else {
		r.pdf.AddParagraph(fmt.Sprintf("📎 %s", url))
	}

	return nil
}

func (r *Renderer) renderQuote(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	r.pdf.AddQuote(text)
	return nil
}

func (r *Renderer) renderTable(block document.BlockNoteBlock) error {
	if len(block.Content) == 0 {
		return nil
	}

	var table document.TableContent
	if err := json.Unmarshal(block.Content, &table); err != nil {
		return fmt.Errorf("unmarshaling table content: %w", err)
	}

	if len(table.Rows) == 0 {
		return nil
	}

	// Convert table to 2D string array
	var cells [][]string
	for _, row := range table.Rows {
		var rowCells []string
		for _, cell := range row.Cells {
			text := r.extractTextFromContentSlice(cell.Content)
			rowCells = append(rowCells, text)
		}
		cells = append(cells, rowCells)
	}

	r.pdf.AddTable(cells)
	return nil
}

// Helper methods for extracting text from BlockNote content

func (r *Renderer) extractTextFromBlock(block document.BlockNoteBlock) string {
	return r.extractTextFromContent(block.Content)
}

func (r *Renderer) extractTextFromContent(rawContent json.RawMessage) string {
	if len(rawContent) == 0 {
		return ""
	}

	var inlineContent []document.BlockNoteContent
	if err := json.Unmarshal(rawContent, &inlineContent); err != nil {
		return ""
	}

	return r.extractTextFromContentSlice(inlineContent)
}

func (r *Renderer) extractTextFromContentSlice(inlineContent []document.BlockNoteContent) string {
	var parts []string
	for _, item := range inlineContent {
		switch item.Type {
		case blocktype.InlineText:
			text := item.Text
			// Apply styles
			if item.Styles != nil {
				if bold, ok := item.Styles[blocktype.StyleBold].(bool); ok && bold {
					text = fmt.Sprintf("**%s**", text)
				}
				if italic, ok := item.Styles[blocktype.StyleItalic].(bool); ok && italic {
					text = fmt.Sprintf("_%s_", text)
				}
				if code, ok := item.Styles[blocktype.StyleCode].(bool); ok && code {
					text = fmt.Sprintf("`%s`", text)
				}
				if strike, ok := item.Styles[blocktype.StyleStrike].(bool); ok && strike {
					text = fmt.Sprintf("~~%s~~", text)
				}
			}
			if text != "" {
				parts = append(parts, text)
			}
		case blocktype.InlineLink:
			linkText := ""
			if len(item.Content) > 0 {
				linkText = r.extractTextFromContentSlice(item.Content)
			}
			if linkText == "" {
				linkText = item.Href
			}
			if linkText != "" {
				parts = append(parts, linkText)
			}
		}
	}

	return strings.Join(parts, "")
}

func (r *Renderer) resolveImagePath(url string) (string, error) {
	// Expected format: /assets/{project}/{hash}{ext}
	parts := strings.Split(strings.Trim(url, "/"), "/")
	if len(parts) < 3 || parts[0] != "assets" {
		return "", fmt.Errorf("invalid asset URL format: %s", url)
	}

	projectAlias := parts[1]
	filename := parts[2]

	// Get assets directory from vault
	assetsDir := r.vault.AssetsPath(projectAlias)
	imagePath := filepath.Join(assetsDir, filename)

	return imagePath, nil
}

