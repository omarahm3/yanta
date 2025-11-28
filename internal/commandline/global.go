package commandline

import (
	"context"
	"fmt"
	"strings"

	"yanta/internal/git"
	"yanta/internal/project"
	"yanta/internal/system"
)

type GlobalCommand string

const (
	GlobalCommandSwitch GlobalCommand = "switch"
	GlobalCommandSync   GlobalCommand = "sync"
	GlobalCommandQuit   GlobalCommand = "quit"
)

type GlobalResultData struct {
	Project *project.Project `json:"project,omitempty"`
}

type GlobalResult struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Data    GlobalResultData `json:"data,omitempty"`
	Context CommandContext   `json:"context"`
}

type GlobalCommands struct {
	projectService *project.Service
	systemService  *system.Service
	parser         *Parser
}

func NewGlobalCommands(
	projectService *project.Service,
	systemService *system.Service,
) *GlobalCommands {
	gc := &GlobalCommands{
		projectService: projectService,
		systemService:  systemService,
		parser:         New(ContextGlobal),
	}

	gc.registerCommands()
	return gc
}

func (gc *GlobalCommands) GetProjectCache() *project.Cache {
	return gc.projectService.GetCache()
}

func (gc *GlobalCommands) GetAllCommands() []GlobalCommand {
	return []GlobalCommand{
		GlobalCommandSwitch,
		GlobalCommandSync,
		GlobalCommandQuit,
	}
}

func (gc *GlobalCommands) Parse(cmd string) (*GlobalResult, error) {
	result, err := gc.parser.Parse(cmd)
	if err != nil {
		return nil, err
	}

	globalResult := &GlobalResult{
		Success: result.Success,
		Message: result.Message,
		Context: result.Context,
	}

	if result.Data != nil {
		if p, ok := result.Data.(*project.Project); ok {
			globalResult.Data = GlobalResultData{
				Project: p,
			}
		}
	}

	return globalResult, nil
}

func (gc *GlobalCommands) registerCommands() {
	gc.parser.MustRegister(
		formatCommand(string(GlobalCommandSwitch), `\s+(@?[a-zA-Z0-9_-]+)$`),
		gc.handleSwitch,
	)
	gc.parser.MustRegister(formatCommand(string(GlobalCommandSync), `$`), gc.handleSync)
	gc.parser.MustRegister(formatCommand(string(GlobalCommandQuit), `$`), gc.handleQuit)
}

func (gc *GlobalCommands) handleSwitch(matches []string, fullCommand string) (*Result, error) {
	if len(matches) < 2 {
		return &Result{
			Success: false,
			Message: "usage: switch @alias or switch alias",
			Context: ContextGlobal,
		}, nil
	}

	alias := strings.TrimSpace(matches[1])

	if !strings.HasPrefix(alias, "@") {
		alias = "@" + alias
	}

	projects, err := gc.projectService.ListActive(context.Background())
	if err != nil {
		return &Result{
			Success: false,
			Message: fmt.Sprintf("failed to load projects: %v", err),
			Context: ContextGlobal,
		}, nil
	}

	var targetProject *project.Project
	for _, p := range projects {
		if strings.EqualFold(p.Alias, alias) {
			targetProject = p
			break
		}
	}

	if targetProject == nil {
		availableAliases := make([]string, 0, len(projects))
		for _, p := range projects {
			availableAliases = append(availableAliases, p.Alias)
		}

		var message string
		if len(availableAliases) > 0 {
			message = fmt.Sprintf(
				"project '%s' not found. available: %s",
				alias,
				strings.Join(availableAliases, ", "),
			)
		} else {
			message = fmt.Sprintf("project '%s' not found. no active projects available.", alias)
		}

		return &Result{
			Success: false,
			Message: message,
			Context: ContextGlobal,
		}, nil
	}

	return &Result{
		Success: true,
		Message: fmt.Sprintf("switched to %s (%s)", targetProject.Alias, targetProject.Name),
		Data:    targetProject,
		Context: ContextGlobal,
	}, nil
}

func (gc *GlobalCommands) handleSync(matches []string, fullCommand string) (*Result, error) {
	syncResult, err := gc.systemService.SyncNow(context.Background())
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "GIT_NOT_ENABLED") {
			return &Result{
				Success: false,
				Message: "Git sync is not enabled. Enable it in Settings.",
				Context: ContextGlobal,
			}, nil
		}
		// For push failures, we still have a partial success (commit worked)
		if syncResult != nil && syncResult.Status == git.SyncStatusPushFailed {
			return &Result{
				Success: true,
				Message: syncResult.Message,
				Data:    syncResult,
				Context: ContextGlobal,
			}, nil
		}
		return &Result{
			Success: false,
			Message: fmt.Sprintf("Sync failed: %v", err),
			Context: ContextGlobal,
		}, nil
	}

	return &Result{
		Success: true,
		Message: syncResult.Message,
		Data:    syncResult,
		Context: ContextGlobal,
	}, nil
}

func (gc *GlobalCommands) handleQuit(matches []string, fullCommand string) (*Result, error) {
	gc.systemService.Quit(context.Background())
	return &Result{
		Success: true,
		Message: "Quitting application...",
		Context: ContextGlobal,
	}, nil
}
