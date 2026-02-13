package app

import (
	"yanta/internal/asset"
	"yanta/internal/backup"
	"yanta/internal/commandline"
	"yanta/internal/config"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/export"
	"yanta/internal/journal"
	"yanta/internal/plugins"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/system"
	"yanta/internal/tag"
)

type Bindings struct {
	Projects         *project.Service
	Documents        *document.Service
	Tags             *tag.Service
	Search           *search.Service
	Plugins          *plugins.WailsService
	System           *system.Service
	Assets           *asset.Service
	Journal          *journal.WailsService
	Config           *config.WailsService
	Backup           *backup.Service
	Export           *export.Service
	ProjectCommands  *commandline.ProjectCommands
	GlobalCommands   *commandline.GlobalCommands
	DocumentCommands *commandline.DocumentCommands
	EventBus         *events.EventBus

	shutdownHandler          func()
	hotkeyReconfigureHandler func(config.HotkeyConfig) error
}

func (b *Bindings) OnStartup() {
	if b.shutdownHandler != nil {
		b.System.SetShutdownHandler(b.shutdownHandler)
	}
	if b.hotkeyReconfigureHandler != nil {
		b.System.SetHotkeyReconfigureHandler(b.hotkeyReconfigureHandler)
	}
}

func (b *Bindings) Bind() []any {
	return []any{
		b.Projects,
		b.Documents,
		b.Tags,
		b.Search,
		b.Plugins,
		b.System,
		b.Assets,
		b.Journal,
		b.Config,
		b.Backup,
		b.Export,
		b.ProjectCommands,
		b.GlobalCommands,
		b.DocumentCommands,
	}
}

func (b *Bindings) ToastInfo(msg string) {
	if b.EventBus != nil {
		b.EventBus.Emit(events.ToastEvent, map[string]any{"type": "info", "message": msg})
	}
}

func (b *Bindings) ToastError(msg string) {
	if b.EventBus != nil {
		b.EventBus.Emit(events.ToastEvent, map[string]any{"type": "error", "message": msg})
	}
}

func (b *Bindings) ToastSuccess(msg string) {
	if b.EventBus != nil {
		b.EventBus.Emit(events.ToastEvent, map[string]any{"type": "success", "message": msg})
	}
}
