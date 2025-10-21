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

var AllDocumentCommands = []struct {
	Value  DocumentCommand
	TSName string
}{
	{DocumentCommandNew, "New"},
	{DocumentCommandDoc, "Doc"},
	{DocumentCommandArchive, "Archive"},
	{DocumentCommandUnarchive, "Unarchive"},
	{DocumentCommandDelete, "Delete"},
	{DocumentCommandTag, "Tag"},
	{DocumentCommandUntag, "Untag"},
	{DocumentCommandTags, "Tags"},
}

type DocumentResultData struct {
	DocumentPath string `json:"documentPath,omitempty"`
	Title        string `json:"title,omitempty"`
}

type DocumentResult struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	Data    DocumentResultData `json:"data,omitempty"`
	Context CommandContext     `json:"context"`
}

type DocumentService interface {
	SoftDelete(path string) error
	Restore(path string) error
}

type TagService interface {
	AddTagsToDocument(docPath string, tagNames []string) error
	RemoveTagsFromDocument(docPath string, tagNames []string) error
	RemoveAllDocumentTags(docPath string) error
	GetDocumentTags(docPath string) ([]string, error)
}

type DocumentCommands struct {
	parser       *Parser
	ctx          context.Context
	docSvc       DocumentService
	tagSvc       TagService
	projectAlias string
	currentPath  string
}

func NewDocumentCommands(docSvc DocumentService, tagSvc TagService) *DocumentCommands {
	dc := &DocumentCommands{
		parser: New(ContextEntry),
		ctx:    context.Background(),
		docSvc: docSvc,
		tagSvc: tagSvc,
	}

	dc.registerCommands()
	return dc
}

func (dc *DocumentCommands) SetContext(ctx context.Context) {
	dc.ctx = ctx
}

func (dc *DocumentCommands) SetCurrentDocument(path string) {
	dc.currentPath = path
}

func (dc *DocumentCommands) ParseWithContext(cmd string, projectAlias string) (*DocumentResult, error) {
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
	dc.parser.MustRegister(formatCommand(string(DocumentCommandArchive), `\s+(.+)$`), dc.handleArchive)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandUnarchive), `\s+(.+)$`), dc.handleUnarchive)
	dc.parser.MustRegister(formatCommand(string(DocumentCommandDelete), `\s+(.+)$`), dc.handleDelete)
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
	path := strings.TrimSpace(matches[1])
	if path == "" {
		return &Result{
			Success: false,
			Message: "usage: archive <path>",
		}, nil
	}

	if err := dc.docSvc.SoftDelete(path); err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to archive document: %v", err),
		}, nil
	}

	return &Result{
		Success: true,
		Message: "document archived",
	}, nil
}

func (dc *DocumentCommands) handleUnarchive(matches []string, fullCommand string) (*Result, error) {
	path := strings.TrimSpace(matches[1])
	if path == "" {
		return &Result{
			Success: false,
			Message: "usage: unarchive <path>",
		}, nil
	}

	if err := dc.docSvc.Restore(path); err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to unarchive document: %v", err),
		}, nil
	}

	return &Result{
		Success: true,
		Message: "document unarchived",
	}, nil
}

func (dc *DocumentCommands) handleDelete(matches []string, fullCommand string) (*Result, error) {
	path := strings.TrimSpace(matches[1])
	if path == "" {
		return &Result{
			Success: false,
			Message: "usage: delete <path>",
		}, nil
	}

	if err := dc.docSvc.SoftDelete(path); err != nil {
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

	if err := dc.tagSvc.AddTagsToDocument(dc.currentPath, tagNames); err != nil {
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
		if err := dc.tagSvc.RemoveAllDocumentTags(dc.currentPath); err != nil {
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

	if err := dc.tagSvc.RemoveTagsFromDocument(dc.currentPath, tagNames); err != nil {
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

	tags, err := dc.tagSvc.GetDocumentTags(dc.currentPath)
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
