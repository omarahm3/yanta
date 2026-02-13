import type { Document } from "./Document";
import type { Project } from "./Project";

export type {
	PaneLayoutState,
	PaneLeaf,
	PaneNode,
	PaneSplit,
	ScrollPosition,
	SplitDirection,
} from "../../pane/types";
export { createDefaultPaneLayout, MAX_PANES } from "../../pane/types";
export type {
	BlockNoteBlock,
	BlockNoteContent,
	Document,
	DocumentMeta,
	DocumentWithTags,
	SaveDocumentRequest,
} from "./Document";
export {
	documentFromModel,
	documentsFromModels,
	documentToSaveRequest,
	documentWithTagsFromModel,
} from "./Document";
export type { GlobalHotkeyConfig } from "./globalHotkeys";
export {
	formatHotkey,
	globalHotkeyConfigFromModel,
	globalHotkeyConfigToModel,
} from "./globalHotkeys";
export type {
	HotkeyConfig,
	HotkeyContextValue,
	RegisteredHotkey,
} from "./hotkeys";
export type { NavigationState, PageName } from "./navigation";
export type { ExtendedProject, Project, ProjectType } from "./Project";
export {
	extendProject,
	projectFromModel,
	projectsFromModels,
	projectToModel,
} from "./Project";
export type { AppInfo, DatabaseInfo, SystemInfo } from "./System";
export { systemInfoFromModel } from "./System";
export type { Tag } from "./Tag";
export { tagFromModel, tagsFromModels, tagToModel } from "./Tag";

export interface Filter {
	id: string;
	name: string;
	displayName: string;
	entryCount: number;
	type: "time" | "category" | "project";
}

export interface Command {
	id: string;
	icon: string;
	text: string;
	hint: string;
	action: () => void;
}

export interface DateSeparator {
	date: string;
	displayName: string;
}

export interface NavigationItem {
	id: string;
	label: string;
	active?: boolean;
	onClick?: () => void;
}

export interface YantaState {
	currentProject?: Project;
	documents: Document[];
	projects: Project[];
	filters: Filter[];
	commandPaletteOpen: boolean;
	commandInput: string;
	selectedCommandIndex: number;
	currentPage?: "dashboard" | "projects" | "timeline" | "search" | "settings";
}

export interface HelpCommand {
	command: string;
	description: string;
}

export interface SettingsState {
	gitSync: {
		enabled: boolean;
		repositoryPath: string;
		remoteUrl: string;
		syncFrequency: "realtime" | "hourly" | "daily" | "weekly" | "manual";
	};
	export: {
		defaultFormat: "md" | "json" | "html" | "txt";
		includeTimestamps: boolean;
		includeProjectContext: boolean;
		includeSyntaxHighlighting: boolean;
	};
	shortcuts: Record<string, string>;
}

export interface VersionInfo {
	version: string;
	buildNumber: string;
	database: string;
	entriesCount: number;
	storageUsed: string;
	platform: string;
}
