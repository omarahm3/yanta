// Package events defines event types and provides an event bus for inter-component communication.
package events

import "github.com/wailsapp/wails/v3/pkg/application"

// Typed event payload structs for high-traffic events.
// These are registered with the Wails binding generator to produce
// type-safe event helpers on the frontend.

// EntryCreatedData is the payload for entry creation events.
// Fields are optional (pointers) because documents and journal entries
// emit different subsets: documents use Path/Title, journals use Date/EntryID.
type EntryCreatedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title,omitempty"`
	Type      string `json:"type,omitempty"`  // "journal" or "document"
	Date      string `json:"date,omitempty"`  // journal entries only
	EntryID   string `json:"entryId,omitempty"` // journal entries only
}

// EntryUpdatedData is the payload for entry update events.
type EntryUpdatedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title,omitempty"`
	Type      string `json:"type,omitempty"`
	Date      string `json:"date,omitempty"`
	EntryID   string `json:"entryId,omitempty"`
}

// EntryDeletedData is the payload for entry deletion events.
type EntryDeletedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Type      string `json:"type,omitempty"`    // "journal" or "document"
	Date      string `json:"date,omitempty"`    // journal entries only
	EntryID   string `json:"entryId,omitempty"` // journal entries only
	Hard      bool   `json:"hard,omitempty"`    // true for permanent deletion
}

// EntryRestoredData is the payload for entry restore events.
type EntryRestoredData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Type      string `json:"type,omitempty"`    // "journal" or "document"
	Date      string `json:"date,omitempty"`    // journal entries only
	EntryID   string `json:"entryId,omitempty"` // journal entries only
}

// ProjectChangedData is the payload for project lifecycle events.
type ProjectChangedData struct {
	ID string `json:"id"`
	Op string `json:"op"` // "create", "update", "delete", "restore"
}

func init() {
	application.RegisterEvent[EntryCreatedData](EntryCreated)
	application.RegisterEvent[EntryUpdatedData](EntryUpdated)
	application.RegisterEvent[EntryDeletedData](EntryDeleted)
	application.RegisterEvent[EntryRestoredData](EntryRestored)
	application.RegisterEvent[ProjectChangedData](ProjectChanged)
}

const (
	AppReady            = "yanta/app/ready"
	ToastEvent          = "yanta/ui/toast"
	WindowHidden        = "yanta/window/hidden"         // payload: {reason}
	ProjectChanged      = "yanta/project/changed"       // payload: {id, op:'create|update|delete|restore'}
	ProjectCreated      = "yanta/project/created"       // payload: {id, name, alias}
	ProjectUpdated      = "yanta/project/updated"       // payload: {id, name, alias}
	ProjectDeleted      = "yanta/project/deleted"       // payload: {id, name}
	ProjectRestored     = "yanta/project/restored"      // payload: {id, name}
	ProjectAccessed     = "yanta/project/accessed"      // payload: {id, name}
	ProjectListAccessed = "yanta/project/list-accessed" // payload: {type, count}
	EntryChanged        = "yanta/entry/changed"         // payload: {id, projectId, op:'create|update|delete|restore|access'}
	EntryCreated        = "yanta/entry/created"         // payload: {id, projectId, title}
	EntryUpdated        = "yanta/entry/updated"         // payload: {id, projectId, title}
	EntryDeleted        = "yanta/entry/deleted"         // payload: {id, projectId}
	EntryRestored       = "yanta/entry/restored"        // payload: {id, projectId}
	EntryAccessed       = "yanta/entry/accessed"        // payload: {id, projectId, title}
	EntryListAccessed   = "yanta/entry/list-accessed"   // payload: {projectId, count, limit, offset}
	TagChanged          = "yanta/tag/changed"
	TagCreated          = "yanta/tag/created"         // payload: {id, name}
	TagUpdated          = "yanta/tag/updated"         // payload: {id, name}
	TagDeleted          = "yanta/tag/deleted"         // payload: {id, name}
	TagAccessed         = "yanta/tag/accessed"        // payload: {id, name}
	TagListAccessed     = "yanta/tag/list-accessed"   // payload: {count, limit, offset}
	DocumentTagsUpdated = "yanta/document/tags"       // payload: {path, tags}
	SearchPerformed     = "yanta/search/performed"    // payload: {query, resultCount, duration}
	EntryCountChanged   = "yanta/project/entry-count" // payload: {projectId, count}
)
