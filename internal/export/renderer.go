package export

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"yanta/internal/document"
	"yanta/internal/logger"
)

type Renderer struct {
	pdf           *PDF
	vault         VaultProvider
	projectAlias  string
	listItemIndex int
}

func NewRenderer(pdf *PDF, vault VaultProvider, projectAlias string) *Renderer {
	return &Renderer{
		pdf:           pdf,
		vault:         vault,
		projectAlias:  projectAlias,
		listItemIndex: 0,
	}
}

func (r *Renderer) RenderBlock(block document.BlockNoteBlock) error {
	switch block.Type {
	case "heading":
		return r.renderHeading(block)
	case "paragraph":
		return r.renderParagraph(block)
	case "codeBlock":
		return r.renderCodeBlock(block)
	case "bulletListItem":
		return r.renderBulletListItem(block)
	case "numberedListItem":
		return r.renderNumberedListItem(block)
	case "checkListItem":
		return r.renderCheckListItem(block)
	case "image":
		return r.renderImage(block)
	case "file":
		return r.renderFile(block)
	case "quote":
		return r.renderQuote(block)
	case "table":
		return r.renderTable(block)
	default:
		// For unknown block types, try to extract text
		text := r.extractTextFromBlock(block)
		if text != "" {
			r.pdf.AddParagraph(text)
		}
	}

	// Recursively render children
	for _, child := range block.Children {
		if err := r.RenderBlock(child); err != nil {
			return err
		}
	}

	return nil
}

func (r *Renderer) renderHeading(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	level := 1
	if block.Props != nil {
		if lvl, ok := block.Props["level"].(float64); ok {
			level = int(lvl)
		}
	}

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

func (r *Renderer) renderNumberedListItem(block document.BlockNoteBlock) error {
	text := r.extractTextFromContent(block.Content)
	if text == "" {
		return nil
	}

	r.listItemIndex++
	r.pdf.AddListItem(text, true, r.listItemIndex)
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

	var table tableContent
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
		case "text":
			text := item.Text
			// Apply styles
			if item.Styles != nil {
				if bold, ok := item.Styles["bold"].(bool); ok && bold {
					text = fmt.Sprintf("**%s**", text)
				}
				if italic, ok := item.Styles["italic"].(bool); ok && italic {
					text = fmt.Sprintf("_%s_", text)
				}
				if code, ok := item.Styles["code"].(bool); ok && code {
					text = fmt.Sprintf("`%s`", text)
				}
			}
			if text != "" {
				parts = append(parts, text)
			}
		case "link":
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

// tableContent mirrors the structure from document/blocks.go
type tableContent struct {
	Type         string `json:"type"`
	ColumnWidths []any  `json:"columnWidths"`
	Rows         []struct {
		Cells []struct {
			Type    string                    `json:"type"`
			Content []document.BlockNoteContent `json:"content"`
			Props   map[string]any            `json:"props"`
		} `json:"cells"`
	} `json:"rows"`
}
