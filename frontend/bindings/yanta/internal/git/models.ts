/**
 * Generated type stubs for Wails bindings - git/models
 */

export enum SyncStatus {
	SyncStatusNoChanges = 0,
	SyncStatusUpToDate = 1,
	SyncStatusCommitted = 2,
	SyncStatusSynced = 3,
	SyncStatusPushFailed = 4,
	SyncStatusConflict = 5,
}

export interface SyncResult {
	status: SyncStatus;
	message?: string;
	filesChanged?: number;
}
