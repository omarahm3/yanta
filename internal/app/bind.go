package app

import (
	"yanta/internal/asset"
	"yanta/internal/commandline"
	"yanta/internal/document"
	"yanta/internal/events"
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
	System           *system.Service
	Assets           *asset.Service
	ProjectCommands  *commandline.ProjectCommands
	GlobalCommands   *commandline.GlobalCommands
	DocumentCommands *commandline.DocumentCommands
	EventBus         *events.EventBus

	shutdownHandler func()
}

func (b *Bindings) OnStartup() {
	if b.shutdownHandler != nil {
		b.System.SetShutdownHandler(b.shutdownHandler)
	}
}

func (b *Bindings) Bind() []any {
	return []any{
		b.Projects,
		b.Documents,
		b.Tags,
		b.Search,
		b.System,
		b.Assets,
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
