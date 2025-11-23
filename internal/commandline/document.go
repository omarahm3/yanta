package commandline

import (
	"context"
	"fmt"
	"strings"
)

type DocumentCommand string

const (
	DocumentCommandNew       DocumentCommand = "new"
	DocumentCommandDoc       DocumentCommand = "doc"
	DocumentCommandArchive   DocumentCommand = "archive"
	DocumentCommandUnarchive DocumentCommand = "unarchive"
	DocumentCommandDelete    DocumentCommand = "delete"
	DocumentCommandTag       DocumentCommand = "tag"
	DocumentCommandUntag     DocumentCommand = "untag"
	DocumentCommandTags      DocumentCommand = "tags"
)

type DocumentResultData struct {
	DocumentPath         string   `json:"documentPath,omitempty"`
	Title                string   `json:"title,omitempty"`
	Flags                []string `json:"flags,omitempty"`
	RequiresConfirmation bool     `json:"requiresConfirmation,omitempty"`
	ConfirmationCommand  string   `json:"confirmationCommand,omitempty"`
}

type DocumentResult struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	Data    DocumentResultData `json:"data,omitempty"`
	Context CommandContext     `json:"context"`
}

type DocumentService interface {
	SoftDelete(ctx context.Context, path string) error
	Restore(ctx context.Context, path string) error
	HardDelete(ctx context.Context, path string) error
	HardDeleteBatch(ctx context.Context, paths []string) error
}

type TagService interface {
	AddTagsToDocument(ctx context.Context, docPath string, tagNames []string) error
	RemoveTagsFromDocument(ctx context.Context, docPath string, tagNames []string) error
	RemoveAllDocumentTags(ctx context.Context, docPath string) error
	GetDocumentTags(ctx context.Context, docPath string) ([]string, error)
}

type DocumentCommands struct {
	parser       *Parser
	docSvc       DocumentService
	tagSvc       TagService
	projectAlias string
	currentPath  string
}

func NewDocumentCommands(docSvc DocumentService, tagSvc TagService) *DocumentCommands {
	dc := &DocumentCommands{
		parser: New(ContextEntry),
		docSvc: docSvc,
		tagSvc: tagSvc,
	}

	dc.registerCommands()
	return dc
}

func (dc *DocumentCommands) SetCurrentDocument(path string) {
	dc.currentPath = path
}

func (dc *DocumentCommands) GetAllCommands() []DocumentCommand {
	return []DocumentCommand{
		DocumentCommandNew,
		DocumentCommandDoc,
		DocumentCommandArchive,
		DocumentCommandUnarchive,
		DocumentCommandDelete,
		DocumentCommandTag,
		DocumentCommandUntag,
		DocumentCommandTags,
	}
}

func (dc *DocumentCommands) ParseWithContext(
	cmd string,
	projectAlias string,
) (*DocumentResult, error) {
	dc.projectAlias = projectAlias
	defer func() { dc.projectAlias = "" }()

	return dc.Parse(cmd)
}

func (dc *DocumentCommands) ParseWithDocument(cmd string, docPath string) (*DocumentResult, error) {
	dc.currentPath = docPath
	defer func() { dc.currentPath = "" }()

	return dc.Parse(cmd)
}

func (dc *DocumentCommands) Parse(cmd string) (*DocumentResult, error) {
	result, err := dc.parser.Parse(cmd)
	if err != nil {
		return nil, err
	}

	documentResult := &DocumentResult{
		Success: result.Success,
		Message: result.Message,
		Context: result.Context,
	}

	if result.Data != nil {
		if data, ok := result.Data.(DocumentResultData); ok {
			documentResult.Data = data
		}
	}

	return documentResult, nil
}

func (dc *DocumentCommands) registerCommands() {
	dc.parser.MustRegister(formatCommand(string(DocumentCommandNew), `(?:\s+(.+))?$`), dc.handleNew)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandDoc), `\s+(.+)$`), dc.handleDoc)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandArchive), `\s+(.+)\s+--force$`),
		dc.handleArchiveForce,
	)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandArchive), `\s+(.+)$`),
		dc.handleArchive,
	)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandUnarchive), `(?:\s+(.+))?$`),
		dc.handleUnarchive,
	)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandDelete), `\s+(.+?)(?:\s+--(force|hard))+$`),
		dc.handleDeleteWithFlags,
	)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandDelete), `\s+(.+)\s+--force$`),
		dc.handleDeleteForce,
	)
	dc.parser.MustRegister(
		formatCommand(string(DocumentCommandDelete), `\s+(.+)$`),
		dc.handleDelete,
	)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandTag), `\s+(.+)$`), dc.handleTag)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandUntag), `\s+(.+)$`), dc.handleUntag)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandTags), `$`), dc.handleTags)
	dc.parser.MustRegister(`^(help|\?)$`, dc.handleHelp)
}

func (dc *DocumentCommands) handleNew(matches []string, fullCommand string) (*Result, error) {
	title := ""
	if len(matches) > 1 && matches[1] != "" {
		title = strings.TrimSpace(matches[1])
	}

	return &Result{
		Success: true,
		Message: "navigate to new document",
		Data: DocumentResultData{
			Title: title,
		},
	}, nil
}

func (dc *DocumentCommands) handleDoc(matches []string, fullCommand string) (*Result, error) {
	path := strings.TrimSpace(matches[1])

	if path == "" {
		return &Result{
			Success: false,
			Message: "usage: doc <path>",
		}, nil
	}

	return &Result{
		Success: true,
		Message: "navigate to document",
		Data: DocumentResultData{
			DocumentPath: path,
		},
	}, nil
}

func (dc *DocumentCommands) handleHelp(matches []string, fullCommand string) (*Result, error) {
	return &Result{
		Success: true,
		Message: "help",
		Data:    "help",
	}, nil
}

func (dc *DocumentCommands) handleArchive(matches []string, fullCommand string) (*Result, error) {
	pathsInput := strings.TrimSpace(matches[1])
	if pathsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: archive <path>",
		}, nil
	}

	var paths []string
	if strings.Contains(pathsInput, ",") {
		parts := strings.Split(pathsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathsInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	message := "Confirm archiving "
	if len(paths) == 1 {
		message += "document"
	} else {
		message += fmt.Sprintf("%d documents", len(paths))
	}

	return &Result{
		Success: true,
		Message: message,
		Data: DocumentResultData{
			DocumentPath:         pathsInput,
			RequiresConfirmation: true,
			ConfirmationCommand:  fmt.Sprintf("archive %s --force", pathsInput),
		},
	}, nil
}

func (dc *DocumentCommands) handleArchiveForce(
	matches []string,
	fullCommand string,
) (*Result, error) {
	pathsInput := strings.TrimSpace(matches[1])
	if pathsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: archive <path> --force",
		}, nil
	}

	var paths []string
	if strings.Contains(pathsInput, ",") {
		parts := strings.Split(pathsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathsInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	for _, path := range paths {
		if err := dc.docSvc.SoftDelete(context.Background(), path); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to archive document %s: %v", path, err),
			}, nil
		}
	}

	message := "document archived"
	if len(paths) > 1 {
		message = fmt.Sprintf("%d documents archived", len(paths))
	}

	return &Result{
		Success: true,
		Message: message,
	}, nil
}

func (dc *DocumentCommands) handleUnarchive(matches []string, fullCommand string) (*Result, error) {
	pathInput := ""
	if len(matches) > 1 {
		pathInput = strings.TrimSpace(matches[1])
	}

	var paths []string
	if pathInput == "" {
		if dc.currentPath != "" {
			paths = []string{dc.currentPath}
		} else {
			return &Result{
				Success: false,
				Message: "no document open - use in document editor",
			}, nil
		}
	} else if strings.Contains(pathInput, ",") {
		parts := strings.Split(pathInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	for _, path := range paths {
		if err := dc.docSvc.Restore(context.Background(), path); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to unarchive document %s: %v", path, err),
			}, nil
		}
	}

	message := "document unarchived"
	if len(paths) > 1 {
		message = fmt.Sprintf("%d documents unarchived", len(paths))
	}

	return &Result{
		Success: true,
		Message: message,
	}, nil
}

func (dc *DocumentCommands) handleDelete(matches []string, fullCommand string) (*Result, error) {
	pathsInput := strings.TrimSpace(matches[1])
	if pathsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: delete <path>",
		}, nil
	}

	var paths []string
	if strings.Contains(pathsInput, ",") {
		parts := strings.Split(pathsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathsInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	message := "Confirm deleting "
	if len(paths) == 1 {
		message += "document"
	} else {
		message += fmt.Sprintf("%d documents", len(paths))
	}

	return &Result{
		Success: true,
		Message: message,
		Data: DocumentResultData{
			DocumentPath:         pathsInput,
			RequiresConfirmation: true,
			ConfirmationCommand:  fmt.Sprintf("delete %s --force", pathsInput),
		},
	}, nil
}

func (dc *DocumentCommands) handleDeleteForce(
	matches []string,
	fullCommand string,
) (*Result, error) {
	pathsInput := strings.TrimSpace(matches[1])
	if pathsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: delete <path> --force",
		}, nil
	}

	var paths []string
	if strings.Contains(pathsInput, ",") {
		parts := strings.Split(pathsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathsInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	for _, path := range paths {
		if err := dc.docSvc.SoftDelete(context.Background(), path); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to delete document %s: %v", path, err),
			}, nil
		}
	}

	message := "document deleted"
	if len(paths) > 1 {
		message = fmt.Sprintf("%d documents deleted", len(paths))
	}

	return &Result{
		Success: true,
		Message: message,
		Data: DocumentResultData{
			Flags: []string{"--force"},
		},
	}, nil
}

func (dc *DocumentCommands) handleDeleteWithFlags(
	matches []string,
	fullCommand string,
) (*Result, error) {
	pathsInput := strings.TrimSpace(matches[1])
	if pathsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: delete <path> [--force] [--hard]",
		}, nil
	}

	hasHard := strings.Contains(fullCommand, "--hard")

	var paths []string
	if strings.Contains(pathsInput, ",") {
		parts := strings.Split(pathsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				paths = append(paths, trimmed)
			}
		}
	} else {
		paths = []string{pathsInput}
	}

	if len(paths) == 0 {
		return &Result{
			Success: false,
			Message: "no valid paths provided",
		}, nil
	}

	if hasHard {
		if len(paths) == 1 {
			if err := dc.docSvc.HardDelete(context.Background(), paths[0]); err != nil {
				return &Result{
					Success: false,
					Message: fmt.Sprintf("failed to permanently delete document: %v", err),
				}, nil
			}
			return &Result{
				Success: true,
				Message: "document permanently deleted",
			}, nil
		}

		if err := dc.docSvc.HardDeleteBatch(context.Background(), paths); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to permanently delete documents: %v", err),
			}, nil
		}

		successMsg := fmt.Sprintf("%d documents permanently deleted", len(paths))
		return &Result{
			Success: true,
			Message: successMsg,
		}, nil
	}

	if len(paths) == 1 {
		if err := dc.docSvc.SoftDelete(context.Background(), paths[0]); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to delete document: %v", err),
			}, nil
		}
		return &Result{
			Success: true,
			Message: "document deleted",
		}, nil
	}

	for _, path := range paths {
		if err := dc.docSvc.SoftDelete(context.Background(), path); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to delete document %s: %v", path, err),
			}, nil
		}
	}

	successMsg := fmt.Sprintf("%d documents deleted", len(paths))
	return &Result{
		Success: true,
		Message: successMsg,
	}, nil
}

func (dc *DocumentCommands) handleTag(matches []string, fullCommand string) (*Result, error) {
	if dc.currentPath == "" {
		return &Result{
			Success: false,
			Message: "no document open - use in document editor",
		}, nil
	}

	tagsInput := strings.TrimSpace(matches[1])
	if tagsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: tag <tag1> [tag2] [tag3...] or tag <tag1>, <tag2>, <tag3>...",
		}, nil
	}

	var tagNames []string
	if strings.Contains(tagsInput, ",") {
		parts := strings.Split(tagsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				tagNames = append(tagNames, trimmed)
			}
		}
	} else {
		parts := strings.Fields(tagsInput)
		tagNames = parts
	}

	if len(tagNames) == 0 {
		return &Result{
			Success: false,
			Message: "at least one tag name is required",
		}, nil
	}

	if err := dc.tagSvc.AddTagsToDocument(context.Background(), dc.currentPath, tagNames); err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to add tags: %v", err),
		}, nil
	}

	tagList := strings.Join(tagNames, ", ")
	return &Result{
		Success: true,
		Message: fmt.Sprintf("tags added: %s", tagList),
	}, nil
}

func (dc *DocumentCommands) handleUntag(matches []string, fullCommand string) (*Result, error) {
	if dc.currentPath == "" {
		return &Result{
			Success: false,
			Message: "no document open - use in document editor",
		}, nil
	}

	tagsInput := strings.TrimSpace(matches[1])
	if tagsInput == "" {
		return &Result{
			Success: false,
			Message: "usage: untag <tag1> [tag2] ... or untag * (remove all)",
		}, nil
	}

	if tagsInput == "*" || tagsInput == "all" {
		if err := dc.tagSvc.RemoveAllDocumentTags(context.Background(), dc.currentPath); err != nil {
			return &Result{
				Success: false,
				Message: fmt.Sprintf("failed to remove all tags: %v", err),
			}, nil
		}

		return &Result{
			Success: true,
			Message: "all tags removed",
		}, nil
	}

	var tagNames []string
	if strings.Contains(tagsInput, ",") {
		parts := strings.Split(tagsInput, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed != "" {
				tagNames = append(tagNames, trimmed)
			}
		}
	} else {
		parts := strings.Fields(tagsInput)
		tagNames = parts
	}

	if len(tagNames) == 0 {
		return &Result{
			Success: false,
			Message: "at least one tag name is required",
		}, nil
	}

	if err := dc.tagSvc.RemoveTagsFromDocument(context.Background(), dc.currentPath, tagNames); err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to remove tags: %v", err),
		}, nil
	}

	tagList := strings.Join(tagNames, ", ")
	return &Result{
		Success: true,
		Message: fmt.Sprintf("tags removed: %s", tagList),
	}, nil
}

func (dc *DocumentCommands) handleTags(matches []string, fullCommand string) (*Result, error) {
	if dc.currentPath == "" {
		return &Result{
			Success: false,
			Message: "no document open - use in document editor",
		}, nil
	}

	tags, err := dc.tagSvc.GetDocumentTags(context.Background(), dc.currentPath)
	if err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to get tags: %v", err),
		}, nil
	}

	if len(tags) == 0 {
		return &Result{
			Success: true,
			Message: "no tags",
		}, nil
	}

	tagList := strings.Join(tags, ", ")
	return &Result{
		Success: true,
		Message: fmt.Sprintf("tags: %s", tagList),
	}, nil
}
