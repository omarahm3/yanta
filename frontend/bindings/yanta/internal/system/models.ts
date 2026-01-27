/**
 * Generated type stubs for Wails bindings - system/models
 */

export interface AppInfo {
	version: string;
	buildCommit: string;
	buildDate: string;
	platform: string;
	goVersion: string;
	databasePath: string;
	logLevel: string;
}

export interface DatabaseInfo {
	entriesCount: number;
	projectsCount: number;
	tagsCount: number;
	storageUsed: string;
}

export interface SystemInfo {
	app: AppInfo;
	database: DatabaseInfo;
}
