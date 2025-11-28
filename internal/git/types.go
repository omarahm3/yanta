package git

type SyncStatus string

const (
	SyncStatusNoChanges  SyncStatus = "no_changes"
	SyncStatusCommitted  SyncStatus = "committed"
	SyncStatusSynced     SyncStatus = "synced"
	SyncStatusPushFailed SyncStatus = "push_failed"
	SyncStatusConflict   SyncStatus = "conflict"
	SyncStatusUpToDate   SyncStatus = "up_to_date"
)

type SyncResult struct {
	Status       SyncStatus `json:"status"`
	FilesChanged int        `json:"filesChanged"`
	Message      string     `json:"message"`
	CommitHash   string     `json:"commitHash,omitempty"`
	PushError    string     `json:"pushError,omitempty"`
	Pulled       bool       `json:"pulled"`
	PulledFiles  int        `json:"pulledFiles"`
}

func (r *SyncResult) IsSuccess() bool {
	switch r.Status {
	case SyncStatusNoChanges, SyncStatusCommitted, SyncStatusSynced, SyncStatusUpToDate:
		return true
	default:
		return false
	}
}

func (r *SyncResult) NeedsAttention() bool {
	switch r.Status {
	case SyncStatusPushFailed, SyncStatusConflict:
		return true
	default:
		return false
	}
}
