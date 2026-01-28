package document

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"yanta/internal/asset"
	"yanta/internal/logger"
	"yanta/internal/vault"
)

// Exporter handles exporting documents to markdown format
type Exporter struct {
	fm        *FileManager
	converter *MarkdownConverter
	vault     *vault.Vault
}

// NewExporter creates a new Exporter instance
func NewExporter(v *vault.Vault) *Exporter {
	return &Exporter{
		fm:        NewFileManager(v),
		converter: NewMarkdownConverter(),
		vault:     v,
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

	// Extract asset references from markdown
	assetRefs := e.extractAssetReferences(markdown)
	logger.WithFields(map[string]any{
		"documentPath": req.DocumentPath,
		"assetCount":   len(assetRefs),
	}).Debug("extracted asset references")

	// Ensure output directory exists
	outputDir := filepath.Dir(req.OutputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		logger.WithError(err).WithField("outputDir", outputDir).Error("failed to create output directory")
		return fmt.Errorf("creating output directory: %w", err)
	}

	// Copy assets and rewrite links if there are any assets
	if len(assetRefs) > 0 {
		assetsDir := filepath.Join(outputDir, "assets")

		for _, ref := range assetRefs {
			if err := e.copyAsset(ref, assetsDir); err != nil {
				logger.WithError(err).WithFields(map[string]any{
					"hash": ref.Hash,
					"ext":  ref.Ext,
					"url":  ref.OriginalURL,
				}).Error("failed to copy asset")
				return fmt.Errorf("copying asset %s: %w", ref.OriginalURL, err)
			}
		}

		// Rewrite asset links in markdown
		markdown = e.rewriteAssetLinks(markdown, assetRefs)
		logger.WithFields(map[string]any{
			"documentPath": req.DocumentPath,
			"assetsCopied": len(assetRefs),
		}).Debug("copied assets and rewrote links")
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

// ExportProjectRequest contains parameters for exporting an entire project
type ExportProjectRequest struct {
	ProjectAlias string // Project alias (e.g., "@myproject")
	OutputDir    string // Absolute path to directory where markdown files should be written
}

// ExportProject exports all documents in a project to markdown files
func (e *Exporter) ExportProject(req ExportProjectRequest) error {
	logger.WithFields(map[string]any{
		"projectAlias": req.ProjectAlias,
		"outputDir":    req.OutputDir,
	}).Info("exporting project to markdown")

	if req.ProjectAlias == "" {
		return fmt.Errorf("project alias is required")
	}
	if req.OutputDir == "" {
		return fmt.Errorf("output directory is required")
	}

	// Create output directory
	if err := os.MkdirAll(req.OutputDir, 0755); err != nil {
		logger.WithError(err).WithField("outputDir", req.OutputDir).Error("failed to create output directory")
		return fmt.Errorf("creating output directory: %w", err)
	}

	// List all documents in the project
	logger.WithField("projectAlias", req.ProjectAlias).Debug("listing project documents")
	documentPaths, err := e.fm.ListFiles(req.ProjectAlias)
	if err != nil {
		logger.WithError(err).WithField("projectAlias", req.ProjectAlias).Error("failed to list project documents")
		return fmt.Errorf("listing project documents: %w", err)
	}

	logger.WithFields(map[string]any{
		"projectAlias": req.ProjectAlias,
		"documentCount": len(documentPaths),
	}).Debug("found documents in project")

	// Export each document
	for _, docPath := range documentPaths {
		// Generate output filename from document path
		// e.g., "projects/@myproject/doc-xyz.json" -> "doc-xyz.md"
		filename := filepath.Base(docPath)
		// Replace .json extension with .md
		if filepath.Ext(filename) == ".json" {
			filename = filename[:len(filename)-5] + ".md"
		}
		outputPath := filepath.Join(req.OutputDir, filename)

		logger.WithFields(map[string]any{
			"documentPath": docPath,
			"outputPath":   outputPath,
		}).Debug("exporting document")

		// Export the document
		err := e.ExportDocument(ExportDocumentRequest{
			DocumentPath: docPath,
			OutputPath:   outputPath,
		})
		if err != nil {
			logger.WithError(err).WithFields(map[string]any{
				"documentPath": docPath,
				"outputPath":   outputPath,
			}).Error("failed to export document")
			return fmt.Errorf("exporting document %s: %w", docPath, err)
		}
	}

	logger.WithFields(map[string]any{
		"projectAlias":      req.ProjectAlias,
		"outputDir":         req.OutputDir,
		"documentsExported": len(documentPaths),
	}).Info("project exported successfully")

	return nil
}

// assetReference represents a parsed asset URL
type assetReference struct {
	ProjectAlias string
	Hash         string
	Ext          string
	OriginalURL  string
}

// parseAssetURL parses an asset URL like /api/assets/@project/hash.ext
func (e *Exporter) parseAssetURL(url string) (*assetReference, error) {
	// Match URLs like /api/assets/@project/hash.ext or /api/assets/@project/hash
	re := regexp.MustCompile(`^/api/assets/(@[^/]+)/([a-f0-9]{64})(\.[\w]+)?$`)
	matches := re.FindStringSubmatch(url)

	if matches == nil {
		return nil, fmt.Errorf("invalid asset URL format: %s", url)
	}

	projectAlias := matches[1]
	hash := matches[2]
	ext := matches[3]

	if ext == "" {
		ext = ""
	}

	return &assetReference{
		ProjectAlias: projectAlias,
		Hash:         hash,
		Ext:          ext,
		OriginalURL:  url,
	}, nil
}

// extractAssetReferences extracts all asset URLs from markdown content
func (e *Exporter) extractAssetReferences(markdown string) []*assetReference {
	var refs []*assetReference

	// Match markdown image syntax: ![alt](url)
	imageRe := regexp.MustCompile(`!\[[^\]]*\]\((/api/assets/[^)]+)\)`)
	imageMatches := imageRe.FindAllStringSubmatch(markdown, -1)
	for _, match := range imageMatches {
		if len(match) > 1 {
			if ref, err := e.parseAssetURL(match[1]); err == nil {
				refs = append(refs, ref)
			}
		}
	}

	// Match markdown link syntax: [text](url) - only for asset URLs
	linkRe := regexp.MustCompile(`\[[^\]]+\]\((/api/assets/[^)]+)\)`)
	linkMatches := linkRe.FindAllStringSubmatch(markdown, -1)
	for _, match := range linkMatches {
		if len(match) > 1 {
			if ref, err := e.parseAssetURL(match[1]); err == nil {
				// Check if we already have this ref from image matches
				isDuplicate := false
				for _, existingRef := range refs {
					if existingRef.OriginalURL == ref.OriginalURL {
						isDuplicate = true
						break
					}
				}
				if !isDuplicate {
					refs = append(refs, ref)
				}
			}
		}
	}

	return refs
}

// copyAsset copies an asset from the vault to the export directory
func (e *Exporter) copyAsset(ref *assetReference, assetsDir string) error {
	// Read asset from vault
	data, err := asset.ReadAsset(e.vault, ref.ProjectAlias, ref.Hash, ref.Ext)
	if err != nil {
		return fmt.Errorf("reading asset from vault: %w", err)
	}

	// Ensure assets directory exists
	if err := os.MkdirAll(assetsDir, 0755); err != nil {
		return fmt.Errorf("creating assets directory: %w", err)
	}

	// Write asset to export directory
	filename := ref.Hash + ref.Ext
	destPath := filepath.Join(assetsDir, filename)

	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return fmt.Errorf("writing asset file: %w", err)
	}

	logger.WithFields(map[string]any{
		"hash":     ref.Hash,
		"ext":      ref.Ext,
		"destPath": destPath,
	}).Debug("copied asset")

	return nil
}

// rewriteAssetLinks rewrites asset URLs in markdown to point to local files
func (e *Exporter) rewriteAssetLinks(markdown string, refs []*assetReference) string {
	result := markdown

	for _, ref := range refs {
		// Replace the original URL with a relative path to the assets directory
		localPath := "./assets/" + ref.Hash + ref.Ext
		result = strings.ReplaceAll(result, ref.OriginalURL, localPath)
	}

	return result
}
