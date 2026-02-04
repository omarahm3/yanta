// Package migration handles data migration between YANTA data directories.
package migration

// MigrationStrategy represents how to resolve conflicts when both local and target have vault data.
type MigrationStrategy string

const (
	// StrategyUseRemote keeps the target vault and discards local data (current behavior).
	StrategyUseRemote MigrationStrategy = "use_remote"
	// StrategyUseLocal copies local vault to target, overwriting target data (backs up target first).
	StrategyUseLocal MigrationStrategy = "use_local"
	// StrategyMergeBoth copies local files that don't exist in target, preserving target's existing files.
	StrategyMergeBoth MigrationStrategy = "merge_both"
)

// IsValid checks if the strategy is a valid migration strategy.
func (s MigrationStrategy) IsValid() bool {
	switch s {
	case StrategyUseRemote, StrategyUseLocal, StrategyMergeBoth:
		return true
	}
	return false
}

// VaultStats contains statistics about a vault directory.
type VaultStats struct {
	DocumentCount  int    `json:"documentCount"`
	ProjectCount   int    `json:"projectCount"`
	TotalSize      int64  `json:"totalSize"`
	TotalSizeHuman string `json:"totalSizeHuman"`
}

// MigrationConflictInfo contains conflict detection results for a migration.
type MigrationConflictInfo struct {
	HasConflict bool        `json:"hasConflict"`
	LocalVault  *VaultStats `json:"localVault,omitempty"`
	TargetVault *VaultStats `json:"targetVault,omitempty"`
	LocalPath   string      `json:"localPath"`
	TargetPath  string      `json:"targetPath"`
}
