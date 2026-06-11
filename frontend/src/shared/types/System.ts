import type * as systemModels from "../../../bindings/yanta/internal/system/models";

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

export interface UpdateInfo {
	available: boolean;
	currentVersion: string;
	latestVersion: string;
	releaseUrl: string;
	releaseNotes: string;
	publishedAt: string;
	checked: boolean;
}

export function systemInfoFromModel(model: systemModels.SystemInfo): SystemInfo {
	return {
		app: {
			version: model.app.version,
			buildCommit: model.app.buildCommit,
			buildDate: model.app.buildDate,
			platform: model.app.platform,
			goVersion: model.app.goVersion,
			databasePath: model.app.databasePath,
			logLevel: model.app.logLevel,
		},
		database: {
			entriesCount: model.database.entriesCount,
			projectsCount: model.database.projectsCount,
			tagsCount: model.database.tagsCount,
			storageUsed: model.database.storageUsed,
		},
	};
}

export function updateInfoFromModel(model: systemModels.UpdateInfo): UpdateInfo {
	return {
		available: model.available,
		currentVersion: model.currentVersion,
		latestVersion: model.latestVersion,
		releaseUrl: model.releaseUrl,
		releaseNotes: model.releaseNotes,
		publishedAt: model.publishedAt,
		checked: model.checked,
	};
}
