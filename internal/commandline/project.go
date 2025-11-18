package commandline

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/git"
	"yanta/internal/project"
)

type ProjectCommand string

const (
	ProjectCommandNew       ProjectCommand = "new"
	ProjectCommandArchive   ProjectCommand = "archive"
	ProjectCommandUnarchive ProjectCommand = "unarchive"
	ProjectCommandRename    ProjectCommand = "rename"
	ProjectCommandDelete    ProjectCommand = "delete"
)

type ProjectResultData struct {
	Project              *project.Project `json:"project,omitempty"`
	Alias                string           `json:"alias,omitempty"`
	Flags                []string         `json:"flags,omitempty"`
	RequiresConfirmation bool             `json:"requiresConfirmation,omitempty"`
	ConfirmationCommand  string           `json:"confirmationCommand,omitempty"`
}

type ProjectResult struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    ProjectResultData `json:"data,omitempty"`
	Context CommandContext    `json:"context"`
}

type VaultService interface {
	DeleteProjectDir(projectAlias string) error
}

type ProjectCommands struct {
	projectService  *project.Service
	documentService *document.Service
	vault           VaultService
	syncManager     *git.SyncManager
	parser          *Parser
	eventBus        *events.EventBus
}

func NewProjectCommands(
	projectService *project.Service,
	documentService *document.Service,
	vault VaultService,
	syncManager *git.SyncManager,
	eventBus *events.EventBus,
) *ProjectCommands {
	pc := &ProjectCommands{
		projectService:  projectService,
		documentService: documentService,
		vault:           vault,
		syncManager:     syncManager,
		parser:          New(ContextProject),
		eventBus:        eventBus,
	}

	pc.registerCommands()
	return pc
}

func (pc *ProjectCommands) GetAllCommands() []ProjectCommand {
	return []ProjectCommand{
		ProjectCommandNew,
		ProjectCommandArchive,
		ProjectCommandUnarchive,
		ProjectCommandRename,
		ProjectCommandDelete,
	}
}

func (pc *ProjectCommands) Parse(cmd string) (*ProjectResult, error) {
	result, err := pc.parser.Parse(cmd)
	if err != nil {
		return nil, err
	}

	projectResult := &ProjectResult{
		Success: result.Success,
		Message: result.Message,
		Context: result.Context,
	}

	if result.Data != nil {
		switch data := result.Data.(type) {
		case ProjectResultData:
			projectResult.Data = data
		case *ProjectResultData:
			projectResult.Data = *data
		case *project.Project:
			projectResult.Data = ProjectResultData{Project: data, Alias: data.Alias}
		}
	}

	return projectResult, nil
}

func (pc *ProjectCommands) registerCommands() {
	pc.parser.MustRegister(formatCommand(string(ProjectCommandNew), `\s+(.+)$`), pc.handleNew)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandArchive), `\s+(@\w+)\s+--force$`),
		pc.handleArchiveForce,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandArchive), `\s+(@\w+)$`),
		pc.handleArchive,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandUnarchive), `\s+(@\w+)$`),
		pc.handleUnarchive,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandRename), `\s+(@\w+)\s+(.+)$`),
		pc.handleRename,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandDelete), `\s+(@\w+)(?:\s+--(force|hard))+$`),
		pc.handleDeleteWithFlags,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandDelete), `\s+(@\w+)\s+--force$`),
		pc.handleDeleteForce,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandDelete), `\s+(@\w+)\s+--hard$`),
		pc.handleDeleteHard,
	)
	pc.parser.MustRegister(
		formatCommand(string(ProjectCommandDelete), `\s+(@\w+)$`),
		pc.handleDelete,
	)
	pc.parser.MustRegister(`^(help|\?)$`, pc.handleHelp)
}

func (pc *ProjectCommands) handleNew(matches []string, fullCommand string) (*Result, error) {
	commandText := strings.TrimSpace(matches[1])

	dates := ExtractDates(commandText)
	textWithoutDates := RemoveDatesFromText(commandText)
	parts := strings.Fields(textWithoutDates)

	if len(parts) < 2 {
		return &Result{
			Success: false,
			Message: "usage: new [name] [alias] [start-date] [end-date] (e.g., 'new AcmeCorp @work 25-10-2024 31-12-2024')",
		}, nil
	}

	aliasIndex := -1
	for i, part := range parts {
		if strings.HasPrefix(part, "@") {
			aliasIndex = i
			break
		}
	}

	if aliasIndex == -1 {
		return &Result{
			Success: false,
			Message: "alias must start with @",
		}, nil
	}

	alias := parts[aliasIndex]
	name := strings.Join(parts[:aliasIndex], "")

	if strings.Contains(name, " ") {
		return &Result{
			Success: false,
			Message: "project name cannot contain spaces. use camelCase or underscores instead (e.g., 'AcmeCorp' or 'acme_corp')",
		}, nil
	}

	aliasPattern := regexp.MustCompile(`^@[a-zA-Z0-9_-]+$`)
	if !aliasPattern.MatchString(alias) {
		return &Result{
			Success: false,
			Message: "alias can only contain letters, numbers, hyphens, and underscores",
		}, nil
	}

	startDate := ""
	endDate := ""

	if len(dates) > 0 {
		if dates[0] != "" {
			startDate = FormatDate(dates[0])
		}
		if len(dates) > 1 && dates[1] != "" {
			endDate = FormatDate(dates[1])
		}
	}

	if startDate == "" {
		startDate = time.Now().Format("2006-01-02")
	}

	projectID, err := pc.projectService.Create(context.Background(),
		strings.TrimSpace(name),
		strings.TrimSpace(alias),
		startDate,
		endDate,
	)
	if err != nil {
		return nil, err
	}

	createdProject, err := pc.projectService.Get(context.Background(), projectID)
	if err != nil {
		return nil, err
	}

	if pc.eventBus != nil {
		pc.eventBus.Emit("yanta/project/changed", map[string]any{
			"id": createdProject.ID,
			"op": "create",
		})
	}

	return &Result{
		Success: true,
		Message: fmt.Sprintf("created project: %s", createdProject.Name),
		Data: ProjectResultData{
			Project: createdProject,
			Alias:   createdProject.Alias,
		},
	}, nil
}

func (pc *ProjectCommands) handleArchive(matches []string, fullCommand string) (*Result, error) {
	alias := matches[1]

	projects, err := pc.projectService.ListActive(context.Background())
	if err != nil {
		return nil, err
	}

	var proj *project.Project
	for _, p := range projects {
		if p.Alias == alias {
			proj = p
			break
		}
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	entryCount, err := pc.projectService.GetDocumentCount(context.Background(), proj.ID)
	if err != nil {
		return nil, err
	}

	message := fmt.Sprintf("Confirm archiving project '%s'", proj.Name)
	if entryCount > 0 {
		message += fmt.Sprintf(" (will archive %d entries)", entryCount)
	}

	return &Result{
		Success: true,
		Message: message,
		Data: ProjectResultData{
			Project:              proj,
			Alias:                alias,
			RequiresConfirmation: true,
			ConfirmationCommand:  fmt.Sprintf("archive %s --force", alias),
		},
	}, nil
}

func (pc *ProjectCommands) handleArchiveForce(
	matches []string,
	fullCommand string,
) (*Result, error) {
	alias := matches[1]

	projects, err := pc.projectService.ListActive(context.Background())
	if err != nil {
		return nil, err
	}

	var proj *project.Project
	for _, p := range projects {
		if p.Alias == alias {
			proj = p
			break
		}
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	err = pc.projectService.SoftDelete(context.Background(), proj.ID)
	if err != nil {
		return nil, err
	}

	if pc.eventBus != nil {
		pc.eventBus.Emit("yanta/project/changed", map[string]any{
			"id": proj.ID,
			"op": "delete",
		})
	}

	return &Result{
		Success: true,
		Message: fmt.Sprintf("archived project: %s", proj.Name),
		Data: ProjectResultData{
			Project: proj,
			Alias:   alias,
			Flags:   []string{"--force"},
		},
	}, nil
}

func (pc *ProjectCommands) handleUnarchive(matches []string, fullCommand string) (*Result, error) {
	alias := matches[1]

	projects, err := pc.projectService.ListArchived(context.Background())
	if err != nil {
		return nil, err
	}

	var proj *project.Project
	for _, p := range projects {
		if p.Alias == alias {
			proj = p
			break
		}
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("archived project not found: %s", alias),
		}, nil
	}

	err = pc.projectService.Restore(context.Background(), proj.ID)
	if err != nil {
		return nil, err
	}

	if pc.eventBus != nil {
		pc.eventBus.Emit("yanta/project/changed", map[string]any{
			"id": proj.ID,
			"op": "restore",
		})
	}

	return &Result{
		Success: true,
		Message: fmt.Sprintf("restored project: %s", proj.Name),
		Data: ProjectResultData{
			Project: proj,
			Alias:   alias,
		},
	}, nil
}

func (pc *ProjectCommands) handleRename(matches []string, fullCommand string) (*Result, error) {
	alias := matches[1]
	newName := matches[2]

	projects, err := pc.projectService.ListActive(context.Background())
	if err != nil {
		return nil, err
	}

	var proj *project.Project
	for _, p := range projects {
		if p.Alias == alias {
			proj = p
			break
		}
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	proj.Name = strings.TrimSpace(newName)

	err = pc.projectService.Update(context.Background(), proj)
	if err != nil {
		return nil, err
	}

	return &Result{
		Success: true,
		Message: fmt.Sprintf("renamed project to: %s", proj.Name),
		Data: ProjectResultData{
			Project: proj,
			Alias:   alias,
		},
	}, nil
}

func (pc *ProjectCommands) handleDelete(matches []string, fullCommand string) (*Result, error) {
	alias := matches[1]

	proj, alreadyDeleted, err := pc.findProjectByAlias(alias)
	if err != nil {
		return nil, err
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	if alreadyDeleted {
		return &Result{
			Success: true,
			Message: fmt.Sprintf("project already deleted: %s", proj.Name),
			Data: ProjectResultData{
				Project: proj,
				Alias:   alias,
			},
		}, nil
	}

	entryCount, err := pc.projectService.GetDocumentCount(context.Background(), proj.ID)
	if err != nil {
		return nil, err
	}

	message := fmt.Sprintf("Confirm deleting project '%s'", proj.Name)
	if entryCount > 0 {
		message += fmt.Sprintf(" (soft delete %d entries)", entryCount)
	}

	return &Result{
		Success: true,
		Message: message,
		Data: ProjectResultData{
			Project:              proj,
			Alias:                alias,
			Flags:                []string{},
			RequiresConfirmation: true,
			ConfirmationCommand:  fmt.Sprintf("delete %s --force", alias),
		},
	}, nil
}

func (pc *ProjectCommands) handleDeleteForce(
	matches []string,
	fullCommand string,
) (*Result, error) {
	alias := matches[1]

	proj, alreadyDeleted, err := pc.findProjectByAlias(alias)
	if err != nil {
		return nil, err
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	if alreadyDeleted {
		return &Result{
			Success: true,
			Message: fmt.Sprintf("project already deleted: %s", proj.Name),
			Data: ProjectResultData{
				Project: proj,
				Alias:   alias,
				Flags:   []string{"--force"},
			},
		}, nil
	}

	entryCount, err := pc.softDeleteProject(proj)
	if err != nil {
		return nil, err
	}

	message := fmt.Sprintf("force deleted project: %s", proj.Name)
	if entryCount > 0 {
		message += fmt.Sprintf(" (soft deleted %d entries)", entryCount)
	}

	return &Result{
		Success: true,
		Message: message,
		Data: ProjectResultData{
			Project: proj,
			Alias:   alias,
			Flags:   []string{"--force"},
		},
	}, nil
}

func (pc *ProjectCommands) handleDeleteWithFlags(
	matches []string,
	fullCommand string,
) (*Result, error) {
	alias := matches[1]
	hasForce := strings.Contains(fullCommand, "--force")
	hasHard := strings.Contains(fullCommand, "--hard")

	proj, alreadyDeleted, err := pc.findProjectByAlias(alias)
	if err != nil {
		return nil, err
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	if alreadyDeleted {
		message := fmt.Sprintf("project already deleted: %s", proj.Name)
		flags := []string{}
		if hasForce {
			flags = append(flags, "--force")
		}
		if hasHard {
			flags = append(flags, "--hard")
		}
		return &Result{
			Success: true,
			Message: message,
			Data: ProjectResultData{
				Project: proj,
				Alias:   alias,
				Flags:   flags,
			},
		}, nil
	}

	if hasHard {
		if err := pc.documentService.HardDeleteByProject(context.Background(), proj.Alias); err != nil {
			return nil, err
		}

		if err := pc.projectService.HardDelete(context.Background(), proj.ID); err != nil {
			return nil, err
		}

		if err := pc.vault.DeleteProjectDir(proj.Alias); err != nil {
			return nil, err
		}

		pc.syncManager.NotifyChange(fmt.Sprintf("deleted project %s", proj.Alias))

		message := fmt.Sprintf(
			"permanently deleted project: %s (with all documents and files)",
			proj.Name,
		)
		flags := []string{}
		if hasForce {
			flags = append(flags, "--force")
		}
		flags = append(flags, "--hard")

		return &Result{
			Success: true,
			Message: message,
			Data: ProjectResultData{
				Project: proj,
				Alias:   alias,
				Flags:   flags,
			},
		}, nil
	}

	entryCount, err := pc.softDeleteProject(proj)
	if err != nil {
		return nil, err
	}

	message := fmt.Sprintf("force deleted project: %s", proj.Name)
	if entryCount > 0 {
		message += fmt.Sprintf(" (soft deleted %d entries)", entryCount)
	}

	return &Result{
		Success: true,
		Message: message,
		Data: ProjectResultData{
			Project: proj,
			Alias:   alias,
			Flags:   []string{"--force"},
		},
	}, nil
}

func (pc *ProjectCommands) handleDeleteHard(
	matches []string,
	fullCommand string,
) (*Result, error) {
	alias := matches[1]

	proj, _, err := pc.findProjectByAlias(alias)
	if err != nil {
		return nil, err
	}

	if proj == nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("project not found: %s", alias),
		}, nil
	}

	entryCount, err := pc.projectService.GetDocumentCount(context.Background(), proj.ID)
	if err != nil {
		return nil, err
	}

	message := fmt.Sprintf("Confirm permanently deleting project '%s'", proj.Name)
	if entryCount > 0 {
		message += fmt.Sprintf(" (hard delete %d entries and all files)", entryCount)
	}

	return &Result{
		Success: true,
		Message: message,
		Data: ProjectResultData{
			Project:              proj,
			Alias:                alias,
			Flags:                []string{"--hard"},
			RequiresConfirmation: true,
			ConfirmationCommand:  fmt.Sprintf("delete %s --force --hard", alias),
		},
	}, nil
}

func (pc *ProjectCommands) handleHelp(matches []string, fullCommand string) (*Result, error) {
	return &Result{
		Success: true,
		Message: "help",
		Data:    "help",
	}, nil
}

func (pc *ProjectCommands) findProjectByAlias(alias string) (*project.Project, bool, error) {
	activeProjects, err := pc.projectService.ListActive(context.Background())
	if err != nil {
		return nil, false, err
	}

	for _, p := range activeProjects {
		if p.Alias == alias {
			return p, false, nil
		}
	}

	archivedProjects, err := pc.projectService.ListArchived(context.Background())
	if err != nil {
		return nil, false, err
	}

	for _, p := range archivedProjects {
		if p.Alias == alias {
			return p, true, nil
		}
	}

	return nil, false, nil
}

func (pc *ProjectCommands) softDeleteProject(proj *project.Project) (int, error) {
	entryCount, err := pc.projectService.GetDocumentCount(context.Background(), proj.ID)
	if err != nil {
		return 0, err
	}

	if err := pc.documentService.SoftDeleteByProject(context.Background(), proj.Alias); err != nil {
		return 0, err
	}

	if err := pc.projectService.SoftDelete(context.Background(), proj.ID); err != nil {
		return 0, err
	}

	return entryCount, nil
}
