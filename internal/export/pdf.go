package export

import (
	"fmt"

	"github.com/jung-kurt/gofpdf"
)

type PDF struct {
	pdf *gofpdf.Fpdf
}

type PDFConfig struct {
	Title   string
	Author  string
	Subject string
}

func NewPDF(cfg PDFConfig) (*PDF, error) {
	// Create new PDF with A4 page size, portrait orientation, and mm units
	pdf := gofpdf.New("P", "mm", "A4", "")

	// Set document properties
	pdf.SetTitle(cfg.Title, true)
	pdf.SetAuthor(cfg.Author, true)
	pdf.SetSubject(cfg.Subject, true)
	pdf.SetCreator("Yanta PDF Exporter", true)

	// Add first page
	pdf.AddPage()

	// Set default font
	pdf.SetFont("Arial", "", 12)

	// Set auto page break
	pdf.SetAutoPageBreak(true, 15)

	// Set margins (left, top, right)
	pdf.SetMargins(20, 20, 20)

	return &PDF{pdf: pdf}, nil
}

func (p *PDF) GetFpdf() *gofpdf.Fpdf {
	return p.pdf
}

func (p *PDF) AddHeading(level int, text string) {
	fontSize := 16.0
	style := "B"

	switch level {
	case 1:
		fontSize = 18.0
		p.pdf.Ln(8)
	case 2:
		fontSize = 16.0
		p.pdf.Ln(6)
	case 3:
		fontSize = 14.0
		p.pdf.Ln(4)
	default:
		fontSize = 12.0
		p.pdf.Ln(3)
	}

	p.pdf.SetFont("Arial", style, fontSize)
	p.pdf.MultiCell(0, fontSize*0.5, text, "", "", false)
	p.pdf.Ln(4)

	// Reset to normal font
	p.pdf.SetFont("Arial", "", 12)
}

func (p *PDF) AddParagraph(text string) {
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.MultiCell(0, 6, text, "", "", false)
	p.pdf.Ln(3)
}

func (p *PDF) AddCodeBlock(code, language string) {
	// Add background color for code block
	p.pdf.SetFillColor(245, 245, 245)
	p.pdf.SetTextColor(40, 40, 40)

	// Add language label if provided
	if language != "" {
		p.pdf.SetFont("Arial", "I", 10)
		p.pdf.CellFormat(0, 5, fmt.Sprintf("# %s", language), "", 1, "", false, 0, "")
	}

	// Add code content with monospace font
	p.pdf.SetFont("Courier", "", 10)
	p.pdf.MultiCell(0, 5, code, "1", "", true)
	p.pdf.Ln(3)

	// Reset colors and font
	p.pdf.SetFillColor(255, 255, 255)
	p.pdf.SetTextColor(0, 0, 0)
	p.pdf.SetFont("Arial", "", 12)
}

func (p *PDF) AddListItem(text string, ordered bool, index int) {
	bullet := "• "
	if ordered {
		bullet = fmt.Sprintf("%d. ", index)
	}

	currentX := p.pdf.GetX()
	currentY := p.pdf.GetY()

	// Add bullet/number
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.SetXY(currentX+5, currentY)
	p.pdf.Cell(10, 6, bullet)

	// Add text with indent
	p.pdf.SetXY(currentX+15, currentY)
	p.pdf.MultiCell(0, 6, text, "", "", false)
	p.pdf.Ln(1)
}

func (p *PDF) AddQuote(text string) {
	// Italic style for quotes
	p.pdf.SetFont("Arial", "I", 12)
	p.pdf.SetTextColor(80, 80, 80)

	// Add left border for quote
	currentX := p.pdf.GetX()
	currentY := p.pdf.GetY()

	// Calculate approximate height based on text length and line height
	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	availableWidth := pageWidth - leftMargin - rightMargin - 15

	// Estimate number of lines
	lineHeight := 6.0
	numLines := len(text)/int(availableWidth*0.5) + 1
	estimatedHeight := float64(numLines) * lineHeight

	p.pdf.SetDrawColor(200, 200, 200)
	p.pdf.SetLineWidth(1)
	p.pdf.Line(currentX+5, currentY, currentX+5, currentY+estimatedHeight+3)

	// Add quote text with indent
	p.pdf.SetX(currentX + 10)
	p.pdf.MultiCell(0, lineHeight, text, "", "", false)
	p.pdf.Ln(3)

	// Reset styles
	p.pdf.SetTextColor(0, 0, 0)
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.SetDrawColor(0, 0, 0)
}

func (p *PDF) AddImage(imagePath string, caption string) error {
	// Register image
	opt := gofpdf.ImageOptions{
		ImageType: "",
		ReadDpi:   false,
	}

	// Get page width
	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	maxWidth := pageWidth - leftMargin - rightMargin

	// Add image with auto height calculation
	p.pdf.ImageOptions(imagePath, p.pdf.GetX(), p.pdf.GetY(), maxWidth*0.8, 0, false, opt, 0, "")

	// Add caption if provided
	if caption != "" {
		p.pdf.Ln(2)
		p.pdf.SetFont("Arial", "I", 10)
		p.pdf.SetTextColor(100, 100, 100)
		p.pdf.MultiCell(0, 5, caption, "", "C", false)
		p.pdf.SetTextColor(0, 0, 0)
		p.pdf.SetFont("Arial", "", 12)
	}

	p.pdf.Ln(5)
	return nil
}

func (p *PDF) AddTable(cells [][]string) {
	if len(cells) == 0 {
		return
	}

	// Calculate column width
	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	availableWidth := pageWidth - leftMargin - rightMargin

	numCols := len(cells[0])
	colWidth := availableWidth / float64(numCols)

	// Set table styling
	p.pdf.SetFont("Arial", "B", 11)
	p.pdf.SetFillColor(240, 240, 240)

	// Draw header row if present
	if len(cells) > 0 {
		for _, cell := range cells[0] {
			p.pdf.CellFormat(colWidth, 7, cell, "1", 0, "", true, 0, "")
		}
		p.pdf.Ln(-1)
	}

	// Draw data rows
	p.pdf.SetFont("Arial", "", 10)
	p.pdf.SetFillColor(255, 255, 255)

	for i := 1; i < len(cells); i++ {
		// Alternate row colors
		if i%2 == 0 {
			p.pdf.SetFillColor(250, 250, 250)
		} else {
			p.pdf.SetFillColor(255, 255, 255)
		}

		for _, cell := range cells[i] {
			p.pdf.CellFormat(colWidth, 6, cell, "1", 0, "", true, 0, "")
		}
		p.pdf.Ln(-1)
	}

	p.pdf.Ln(3)
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.SetFillColor(255, 255, 255)
}

func (p *PDF) AddLineBreak() {
	p.pdf.Ln(5)
}

func (p *PDF) SaveToFile(path string) error {
	return p.pdf.OutputFileAndClose(path)
}
