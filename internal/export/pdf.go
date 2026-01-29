package export

import (
	"fmt"

	"github.com/jung-kurt/gofpdf"
)

type PDF struct {
	pdf *gofpdf.Fpdf
	tr  func(string) string
}

type PDFConfig struct {
	Title   string
	Author  string
	Subject string
}

func NewPDF(cfg PDFConfig) (*PDF, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")

	pdf.SetTitle(tr(cfg.Title), true)
	pdf.SetAuthor(tr(cfg.Author), true)
	pdf.SetSubject(tr(cfg.Subject), true)
	pdf.SetCreator("Yanta PDF Exporter", true)
	pdf.AddPage()
	pdf.SetFont("Arial", "", 12)
	pdf.SetAutoPageBreak(true, 15)
	pdf.SetMargins(20, 20, 20)

	return &PDF{pdf: pdf, tr: tr}, nil
}

func (p *PDF) GetFpdf() *gofpdf.Fpdf {
	return p.pdf
}

func (p *PDF) AddHeading(level int, text string) {
	var fontSize float64
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
	p.pdf.MultiCell(0, fontSize*0.5, p.tr(text), "", "", false)
	p.pdf.Ln(4)
	p.pdf.SetFont("Arial", "", 12)
}

func (p *PDF) AddParagraph(text string) {
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.MultiCell(0, 6, p.tr(text), "", "", false)
	p.pdf.Ln(3)
}

func (p *PDF) AddCodeBlock(code, language string) {
	p.pdf.SetFillColor(245, 245, 245)
	p.pdf.SetTextColor(40, 40, 40)

	if language != "" {
		p.pdf.SetFont("Arial", "I", 10)
		p.pdf.CellFormat(0, 5, p.tr(fmt.Sprintf("# %s", language)), "", 1, "", false, 0, "")
	}

	p.pdf.SetFont("Courier", "", 10)
	p.pdf.MultiCell(0, 5, p.tr(code), "1", "", true)
	p.pdf.Ln(3)

	p.pdf.SetFillColor(255, 255, 255)
	p.pdf.SetTextColor(0, 0, 0)
	p.pdf.SetFont("Arial", "", 12)
}

func (p *PDF) AddListItem(text string, ordered bool, index int) {
	bullet := p.tr("• ")
	if ordered {
		bullet = fmt.Sprintf("%d. ", index)
	}

	currentX := p.pdf.GetX()
	currentY := p.pdf.GetY()

	p.pdf.SetFont("Arial", "", 12)
	p.pdf.SetXY(currentX+5, currentY)
	p.pdf.Cell(10, 6, bullet)

	p.pdf.SetXY(currentX+15, currentY)
	p.pdf.MultiCell(0, 6, p.tr(text), "", "", false)
	p.pdf.Ln(1)
}

func (p *PDF) AddQuote(text string) {
	p.pdf.SetFont("Arial", "I", 12)
	p.pdf.SetTextColor(80, 80, 80)

	currentX := p.pdf.GetX()
	currentY := p.pdf.GetY()

	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	availableWidth := pageWidth - leftMargin - rightMargin - 15

	lineHeight := 6.0
	numLines := len(text)/int(availableWidth*0.5) + 1
	estimatedHeight := float64(numLines) * lineHeight

	p.pdf.SetDrawColor(200, 200, 200)
	p.pdf.SetLineWidth(1)
	p.pdf.Line(currentX+5, currentY, currentX+5, currentY+estimatedHeight+3)

	p.pdf.SetX(currentX + 10)
	p.pdf.MultiCell(0, lineHeight, p.tr(text), "", "", false)
	p.pdf.Ln(3)

	p.pdf.SetTextColor(0, 0, 0)
	p.pdf.SetFont("Arial", "", 12)
	p.pdf.SetDrawColor(0, 0, 0)
}

func (p *PDF) AddImage(imagePath string, caption string) error {
	opt := gofpdf.ImageOptions{
		ImageType: "",
		ReadDpi:   false,
	}

	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	maxWidth := pageWidth - leftMargin - rightMargin

	p.pdf.ImageOptions(imagePath, p.pdf.GetX(), p.pdf.GetY(), maxWidth*0.8, 0, false, opt, 0, "")

	if caption != "" {
		p.pdf.Ln(2)
		p.pdf.SetFont("Arial", "I", 10)
		p.pdf.SetTextColor(100, 100, 100)
		p.pdf.MultiCell(0, 5, p.tr(caption), "", "C", false)
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

	pageWidth, _ := p.pdf.GetPageSize()
	leftMargin, _, rightMargin, _ := p.pdf.GetMargins()
	availableWidth := pageWidth - leftMargin - rightMargin

	numCols := len(cells[0])
	colWidth := availableWidth / float64(numCols)

	p.pdf.SetFont("Arial", "B", 11)
	p.pdf.SetFillColor(240, 240, 240)

	if len(cells) > 0 {
		for _, cell := range cells[0] {
			p.pdf.CellFormat(colWidth, 7, p.tr(cell), "1", 0, "", true, 0, "")
		}
		p.pdf.Ln(-1)
	}

	p.pdf.SetFont("Arial", "", 10)
	p.pdf.SetFillColor(255, 255, 255)

	for i := 1; i < len(cells); i++ {
		if i%2 == 0 {
			p.pdf.SetFillColor(250, 250, 250)
		} else {
			p.pdf.SetFillColor(255, 255, 255)
		}

		for _, cell := range cells[i] {
			p.pdf.CellFormat(colWidth, 6, p.tr(cell), "1", 0, "", true, 0, "")
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
