package export

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"yanta/internal/document"
	"yanta/internal/logger"
)

type DocumentProvider interface {
	Get(ctx context.Context, path string) (*document.DocumentWithTags, error)
}

type VaultProvider interface {
	RootPath() string
	DocumentPath(relativePath string) (string, error)
	AssetsPath(projectAlias string) string
}

type Service struct {
	docService DocumentProvider
	vault      VaultProvider
}

type ServiceConfig struct {
	DocumentService DocumentProvider
	Vault           VaultProvider
}

func NewService(cfg ServiceConfig) *Service {
	return &Service{
		docService: cfg.DocumentService,
		vault:      cfg.Vault,
	}
}

type ExportRequest struct {
	DocumentPath string
	OutputPath   string
}

func (s *Service) ExportToPDF(ctx context.Context, req ExportRequest) error {
	if s.docService == nil || s.vault == nil {
		return fmt.Errorf("service not initialised correctly")
	}

	if strings.TrimSpace(req.DocumentPath) == "" {
		return fmt.Errorf("document path is required")
	}

	if strings.TrimSpace(req.OutputPath) == "" {
		return fmt.Errorf("output path is required")
	}

	logger.WithFields(map[string]any{
		"docPath":    req.DocumentPath,
		"outputPath": req.OutputPath,
	}).Info("starting PDF export")

	// Get document with metadata
	docWithTags, err := s.docService.Get(ctx, req.DocumentPath)
	if err != nil {
		logger.WithError(err).WithField("path", req.DocumentPath).Error("failed to get document")
		return fmt.Errorf("getting document: %w", err)
	}

	if docWithTags.File == nil {
		return fmt.Errorf("document file is nil")
	}

	logger.WithFields(map[string]any{
		"title":      docWithTags.File.Meta.Title,
		"blockCount": len(docWithTags.File.Blocks),
	}).Debug("document loaded successfully")

	// Create PDF document
	pdf, err := NewPDF(PDFConfig{
		Title:   docWithTags.File.Meta.Title,
		Author:  "Yanta",
		Subject: strings.Join(docWithTags.Tags, ", "),
	})
	if err != nil {
		logger.WithError(err).Error("failed to create PDF")
		return fmt.Errorf("creating PDF: %w", err)
	}

	// Create renderer
	renderer := NewRenderer(pdf, s.vault, docWithTags.File.Meta.Project)

	// Render all blocks
	for _, block := range docWithTags.File.Blocks {
		if err := renderer.RenderBlock(block); err != nil {
			logger.WithError(err).WithField("blockType", block.Type).Error("failed to render block")
			return fmt.Errorf("rendering block: %w", err)
		}
	}

	// Ensure output directory exists
	outputDir := filepath.Dir(req.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		logger.WithError(err).WithField("dir", outputDir).Error("failed to create output directory")
		return fmt.Errorf("creating output directory: %w", err)
	}

	// Save PDF to file
	if err := pdf.SaveToFile(req.OutputPath); err != nil {
		logger.WithError(err).WithField("path", req.OutputPath).Error("failed to save PDF")
		return fmt.Errorf("saving PDF: %w", err)
	}

	logger.WithFields(map[string]any{
		"outputPath": req.OutputPath,
		"title":      docWithTags.File.Meta.Title,
	}).Info("PDF export completed successfully")

	return nil
}
