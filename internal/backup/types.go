package backup

import "time"

// BackupStatus represents the status of a backup operation
type BackupStatus string

const (
	BackupStatusSuccess    BackupStatus = "success"
	BackupStatusFailed     BackupStatus = "failed"
	BackupStatusInProgress BackupStatus = "in_progress"
)

// BackupConfig holds configuration for the backup system
type BackupConfig struct {
	Enabled    bool `json:"enabled" toml:"enabled"`
	MaxBackups int  `json:"maxBackups" toml:"max_backups"`
}

// BackupInfo contains metadata about a specific backup
type BackupInfo struct {
	Timestamp time.Time `json:"timestamp"`
	Path      string    `json:"path"`
	Size      int64     `json:"size"`
}

// BackupResult represents the result of a backup operation
type BackupResult struct {
	Status    BackupStatus `json:"status"`
	Path      string       `json:"path,omitempty"`
	Size      int64        `json:"size,omitempty"`
	Message   string       `json:"message"`
	Error     string       `json:"error,omitempty"`
	Timestamp time.Time    `json:"timestamp"`
}

// IsSuccess returns true if the backup operation was successful
func (r *BackupResult) IsSuccess() bool {
	return r.Status == BackupStatusSuccess
}

// IsFailed returns true if the backup operation failed
func (r *BackupResult) IsFailed() bool {
	return r.Status == BackupStatusFailed
}

// DefaultBackupConfig returns the default backup configuration
func DefaultBackupConfig() BackupConfig {
	return BackupConfig{
		Enabled:    true,
		MaxBackups: 10,
	}
}
