package document

import (
	"fmt"
	"os"
	"path/filepath"

	"yanta/internal/logger"
	"yanta/internal/vault"
)

// Exporter handles exporting documents to markdown format
type Exporter struct {
	fm        *FileManager
	converter *MarkdownConverter
}

// NewExporter creates a new Exporter instance
func NewExporter(v *vault.Vault) *Exporter {
	return &Exporter{
		fm:        NewFileManager(v),
		converter: NewMarkdownConverter(),
	}
}

// ExportDocumentRequest contains parameters for exporting a single document
type ExportDocumentRequest struct {
	DocumentPath string // Path to document in vault (e.g., "projects/@myproject/doc-xyz.json")
	OutputPath   string // Absolute path where markdown file should be written
}

// ExportDocument exports a single document to a markdown file
func (e *Exporter) ExportDocument(req ExportDocumentRequest) error {
	logger.WithFields(map[string]any{
		"documentPath": req.DocumentPath,
		"outputPath":   req.OutputPath,
	}).Info("exporting document to markdown")

	if req.DocumentPath == "" {
		return fmt.Errorf("document path is required")
	}
	if req.OutputPath == "" {
		return fmt.Errorf("output path is required")
	}

	// Read the document file from vault
	logger.WithField("documentPath", req.DocumentPath).Debug("reading document file")
	docFile, err := e.fm.ReadFile(req.DocumentPath)
	if err != nil {
		logger.WithError(err).WithField("documentPath", req.DocumentPath).Error("failed to read document")
		return fmt.Errorf("reading document: %w", err)
	}

	// Convert to markdown
	logger.WithField("documentPath", req.DocumentPath).Debug("converting document to markdown")
	markdown, err := e.converter.ToMarkdown(docFile)
	if err != nil {
		logger.WithError(err).WithField("documentPath", req.DocumentPath).Error("failed to convert to markdown")
		return fmt.Errorf("converting to markdown: %w", err)
	}

	// Ensure output directory exists
	outputDir := filepath.Dir(req.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		logger.WithError(err).WithField("outputDir", outputDir).Error("failed to create output directory")
		return fmt.Errorf("creating output directory: %w", err)
	}

	// Write markdown file
	logger.WithField("outputPath", req.OutputPath).Debug("writing markdown file")
	if err := os.WriteFile(req.OutputPath, []byte(markdown), 0644); err != nil {
		logger.WithError(err).WithField("outputPath", req.OutputPath).Error("failed to write markdown file")
		return fmt.Errorf("writing markdown file: %w", err)
	}

	logger.WithFields(map[string]any{
		"documentPath": req.DocumentPath,
		"outputPath":   req.OutputPath,
		"fileSize":     len(markdown),
	}).Info("document exported successfully")

	return nil
}
