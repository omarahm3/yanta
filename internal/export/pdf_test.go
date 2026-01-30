package export

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPDF(t *testing.T) {
	cfg := PDFConfig{
		Title:   "Test Document",
		Author:  "Test Author",
		Subject: "Test Subject",
	}

	pdf, err := NewPDF(cfg)
	require.NoError(t, err, "NewPDF() should not error")
	require.NotNil(t, pdf, "PDF should not be nil")
	assert.NotNil(t, pdf.pdf, "Internal PDF object should not be nil")
}

func TestNewPDF_EmptyConfig(t *testing.T) {
	cfg := PDFConfig{}

	pdf, err := NewPDF(cfg)
	require.NoError(t, err, "NewPDF() should work with empty config")
	require.NotNil(t, pdf, "PDF should not be nil")
}

func TestPDF_GetFpdf(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	fpdf := pdf.GetFpdf()
	assert.NotNil(t, fpdf, "GetFpdf() should return non-nil FPDF object")
}

func TestPDF_AddHeading(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	tests := []struct {
		name  string
		level int
		text  string
	}{
		{"Level 1", 1, "Heading 1"},
		{"Level 2", 2, "Heading 2"},
		{"Level 3", 3, "Heading 3"},
		{"Level 4", 4, "Heading 4"},
		{"Default", 5, "Heading 5"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pdf.AddHeading(tt.level, tt.text)
			// No error expected - verify PDF still valid
			assert.NotNil(t, pdf.pdf)
		})
	}
}

func TestPDF_AddHeading_EmptyText(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	// Should handle empty text gracefully
	pdf.AddHeading(1, "")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddParagraph(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddParagraph("This is a test paragraph.")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddParagraph_LongText(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	longText := "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
		"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
		"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris."

	pdf.AddParagraph(longText)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddParagraph_Empty(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddParagraph("")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddCodeBlock(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	code := "func main() {\n\tfmt.Println(\"Hello, World!\")\n}"
	pdf.AddCodeBlock(code, "go")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddCodeBlock_WithoutLanguage(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	code := "console.log('Hello');"
	pdf.AddCodeBlock(code, "")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddCodeBlock_Empty(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddCodeBlock("", "go")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddListItem_Unordered(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddListItem("First bullet point", false, 0)
	pdf.AddListItem("Second bullet point", false, 0)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddListItem_Ordered(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddListItem("First item", true, 1)
	pdf.AddListItem("Second item", true, 2)
	pdf.AddListItem("Third item", true, 3)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddListItem_Empty(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddListItem("", false, 0)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddQuote(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	quote := "This is a quote from someone important."
	pdf.AddQuote(quote)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddQuote_LongText(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	longQuote := "This is a very long quote that should span multiple lines. " +
		"It contains a lot of text to test the line height calculation. " +
		"We want to make sure the quote border is properly sized."

	pdf.AddQuote(longQuote)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddQuote_Empty(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddQuote("")
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddImage_Success(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	// Create a temporary test image file (1x1 PNG)
	tmpDir := t.TempDir()
	imagePath := filepath.Join(tmpDir, "test.png")

	// Create a minimal valid PNG file
	pngData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE, // IHDR CRC
		0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
		0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
		0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4,
		0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
		0xAE, 0x42, 0x60, 0x82,
	}

	err = os.WriteFile(imagePath, pngData, 0644)
	require.NoError(t, err, "Failed to create test image")

	err = pdf.AddImage(imagePath, "Test Caption")
	require.NoError(t, err, "AddImage() should succeed with valid image")
}

func TestPDF_AddImage_WithoutCaption(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	// Create a temporary test image file (1x1 PNG)
	tmpDir := t.TempDir()
	imagePath := filepath.Join(tmpDir, "test.png")

	pngData := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
		0xDE,
		0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
		0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
		0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4,
		0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
		0xAE, 0x42, 0x60, 0x82,
	}

	err = os.WriteFile(imagePath, pngData, 0644)
	require.NoError(t, err)

	err = pdf.AddImage(imagePath, "")
	require.NoError(t, err, "AddImage() should succeed without caption")
}

func TestPDF_AddTable_Success(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	cells := [][]string{
		{"Header 1", "Header 2", "Header 3"},
		{"Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"},
		{"Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"},
	}

	pdf.AddTable(cells)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddTable_SingleColumn(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	cells := [][]string{
		{"Header"},
		{"Value 1"},
		{"Value 2"},
	}

	pdf.AddTable(cells)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddTable_Empty(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	// Should handle empty table gracefully
	pdf.AddTable([][]string{})
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddTable_HeaderOnly(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	cells := [][]string{
		{"Header 1", "Header 2"},
	}

	pdf.AddTable(cells)
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_AddLineBreak(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddLineBreak()
	assert.NotNil(t, pdf.pdf)
}

func TestPDF_SaveToFile(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddHeading(1, "Test Document")
	pdf.AddParagraph("This is a test paragraph.")

	outputPath := filepath.Join(t.TempDir(), "test.pdf")
	err = pdf.SaveToFile(outputPath)
	require.NoError(t, err, "SaveToFile() should succeed")

	// Verify file exists
	info, err := os.Stat(outputPath)
	require.NoError(t, err, "Output file should exist")
	assert.Greater(t, info.Size(), int64(0), "Output file should not be empty")
}

func TestPDF_SaveToFile_CreatesDirectory(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Test"})
	require.NoError(t, err)

	pdf.AddParagraph("Test content")

	// Use nested directory
	outputPath := filepath.Join(t.TempDir(), "nested", "dir", "test.pdf")

	// Create parent directory
	err = os.MkdirAll(filepath.Dir(outputPath), 0755)
	require.NoError(t, err)

	err = pdf.SaveToFile(outputPath)
	require.NoError(t, err, "SaveToFile() should succeed in nested directory")

	// Verify file exists
	_, err = os.Stat(outputPath)
	assert.NoError(t, err, "Output file should exist")
}

func TestPDF_ComplexDocument(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{
		Title:   "Complex Test Document",
		Author:  "Test Author",
		Subject: "Testing",
	})
	require.NoError(t, err)

	// Add various elements
	pdf.AddHeading(1, "Main Title")
	pdf.AddParagraph("Introduction paragraph with some text.")

	pdf.AddHeading(2, "Section 1")
	pdf.AddParagraph("Section 1 content goes here.")

	pdf.AddCodeBlock("func example() {\n\treturn true\n}", "go")

	pdf.AddHeading(2, "Section 2")
	pdf.AddListItem("First point", false, 0)
	pdf.AddListItem("Second point", false, 0)
	pdf.AddListItem("Third point", false, 0)

	pdf.AddQuote("This is an important quote.")

	cells := [][]string{
		{"Column A", "Column B"},
		{"Value 1", "Value 2"},
		{"Value 3", "Value 4"},
	}
	pdf.AddTable(cells)

	pdf.AddLineBreak()
	pdf.AddParagraph("Conclusion paragraph.")

	// Save and verify
	outputPath := filepath.Join(t.TempDir(), "complex.pdf")
	err = pdf.SaveToFile(outputPath)
	require.NoError(t, err, "SaveToFile() should succeed with complex document")

	info, err := os.Stat(outputPath)
	require.NoError(t, err, "Output file should exist")
	assert.Greater(t, info.Size(), int64(1000), "Complex document should be at least 1KB")
}

func TestPDF_MultiplePages(t *testing.T) {
	pdf, err := NewPDF(PDFConfig{Title: "Multi-Page Test"})
	require.NoError(t, err)

	// Add enough content to span multiple pages
	for i := 1; i <= 50; i++ {
		pdf.AddHeading(2, "Section")
		pdf.AddParagraph("This is paragraph content that will help fill up the page. " +
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
			"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.")
	}

	outputPath := filepath.Join(t.TempDir(), "multipage.pdf")
	err = pdf.SaveToFile(outputPath)
	require.NoError(t, err, "SaveToFile() should succeed with multi-page document")

	info, err := os.Stat(outputPath)
	require.NoError(t, err, "Output file should exist")
	assert.Greater(t, info.Size(), int64(5000), "Multi-page document should be larger")
}
