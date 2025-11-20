package events

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// EventBus provides an event system abstraction that can be created before
// the application exists, solving circular dependency between services and
// the application runtime.
//
// Pattern:
//  1. Create EventBus before services
//  2. Services receive EventBus in constructor (clean DI)
//  3. EventBus.Connect() called after app creation
//  4. Events emitted before connection are buffered
type EventBus struct {
	mu       sync.RWMutex
	app      *application.App
	window   *application.WebviewWindow
	buffered []bufferedEvent
}

type bufferedEvent struct {
	name string
	data any
}

func NewEventBus() *EventBus {
	return &EventBus{
		buffered: make([]bufferedEvent, 0),
	}
}

func (eb *EventBus) Connect(app *application.App, window *application.WebviewWindow) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.app = app
	eb.window = window

	for _, e := range eb.buffered {
		if app != nil {
			app.Event.Emit(e.name, e.data)
		}
	}
	eb.buffered = nil
}

func (eb *EventBus) Emit(name string, data any) {
	eb.mu.RLock()
	app := eb.app
	eb.mu.RUnlock()

	if app != nil {
		app.Event.Emit(name, data)
	} else {
		// Need full lock for slice mutation
		eb.mu.Lock()
		eb.buffered = append(eb.buffered, bufferedEvent{name, data})
		eb.mu.Unlock()
	}
}

func (eb *EventBus) GetWindow() *application.WebviewWindow {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	return eb.window
}

func (eb *EventBus) GetApp() *application.App {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	return eb.app
}
