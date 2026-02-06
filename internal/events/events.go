// Package events defines event types and provides an event bus for inter-component communication.
package events

import "github.com/wailsapp/wails/v3/pkg/application"

type EntryCreatedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title,omitempty"`
	Type      string `json:"type,omitempty"`
	Date      string `json:"date,omitempty"`
	EntryID   string `json:"entryId,omitempty"`
}

type EntryUpdatedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Title     string `json:"title,omitempty"`
	Type      string `json:"type,omitempty"`
	Date      string `json:"date,omitempty"`
	EntryID   string `json:"entryId,omitempty"`
}

type EntryDeletedData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Type      string `json:"type,omitempty"`
	Date      string `json:"date,omitempty"`
	EntryID   string `json:"entryId,omitempty"`
	Hard      bool   `json:"hard,omitempty"`
}

type EntryRestoredData struct {
	Path      string `json:"path,omitempty"`
	ProjectID string `json:"projectId"`
	Type      string `json:"type,omitempty"`
	Date      string `json:"date,omitempty"`
	EntryID   string `json:"entryId,omitempty"`
}

type EntryMovedData struct {
	Path          string `json:"path,omitempty"`
	FromProjectID string `json:"fromProjectId"`
	ToProjectID   string `json:"toProjectId"`
}

type ProjectChangedData struct {
	ID string `json:"id"`
	Op string `json:"op"`
}

func init() {
	application.RegisterEvent[EntryCreatedData](EntryCreated)
	application.RegisterEvent[EntryUpdatedData](EntryUpdated)
	application.RegisterEvent[EntryDeletedData](EntryDeleted)
	application.RegisterEvent[EntryRestoredData](EntryRestored)
	application.RegisterEvent[EntryMovedData](EntryMoved)
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
	EntryMoved          = "yanta/entry/moved"          // payload: {path, fromProjectId, toProjectId}
	EntryCountChanged   = "yanta/project/entry-count"  // payload: {projectId, count}
)
