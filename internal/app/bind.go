package app

import (
	"context"
	"yanta/internal/asset"
	"yanta/internal/commandline"
	"yanta/internal/document"
	"yanta/internal/events"
	"yanta/internal/project"
	"yanta/internal/search"
	"yanta/internal/system"
	"yanta/internal/tag"

	"github.com/wailsapp/wails/v2/pkg/runtime"
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

	ctx context.Context
}

func (b *Bindings) OnStartup(ctx context.Context) {
	b.ctx = ctx
	b.Projects.SetContext(ctx)
	b.Documents.SetContext(ctx)
	b.Tags.SetContext(ctx)
	b.Search.SetContext(ctx)
	b.System.SetContext(ctx)
	b.Assets.SetContext(ctx)
	b.ProjectCommands.SetContext(ctx)
	b.GlobalCommands.SetContext(ctx)
	b.DocumentCommands.SetContext(ctx)
}

func (b *Bindings) OnShutdown(ctx context.Context) {
	b.ctx = ctx
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

func (b *Bindings) BindEnums() []any {
	return []any{
		commandline.AllProjectCommands,
		commandline.AllGlobalCommands,
		commandline.AllDocumentCommands,
	}
}

func (b *Bindings) ToastInfo(msg string) {
	runtime.EventsEmit(b.ctx, events.ToastEvent, map[string]any{"type": "info", "message": msg})
}

func (b *Bindings) ToastError(msg string) {
	runtime.EventsEmit(b.ctx, events.ToastEvent, map[string]any{"type": "error", "message": msg})
}

func (b *Bindings) ToastSuccess(msg string) {
	runtime.EventsEmit(b.ctx, events.ToastEvent, map[string]any{"type": "success", "message": msg})
}
