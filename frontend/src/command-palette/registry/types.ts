import type { CommandOption } from "../../components/ui";
import type { NavigationState, PageName } from "../../shared/types/navigation";
import type { Project } from "../../types";

/**
 * Context passed to domain command registration functions.
 * Provides navigation, project/document state, and callbacks needed to build commands.
 * Uses app Project type so GlobalCommandPalette can satisfy this without type casts.
 */
export interface CommandRegistryContext {
	onNavigate: (page: PageName, state?: NavigationState) => void;
	handleClose: () => void;
	currentPage?: PageName;
	currentProject: Project | null;
	previousProject: Project | null;
	projects: Project[];
	setCurrentProject: (project: Project | undefined) => void;
	switchToLastProject: () => void;
	getSelectedDocument: () => { path?: string } | null;
	notification: {
		success: (msg: string) => void;
		error: (msg: string) => void;
		info: (msg: string) => void;
		warning: (msg: string) => void;
	};
	showGitError: (error: unknown) => void;
	onToggleArchived?: () => void;
	showArchived?: boolean;
	onToggleSidebar?: () => void;
	onShowHelp?: () => void;
	resetLayout: () => void;
	setShowRecentDocuments: (show: boolean) => void;
}

/** Registry interface: register commands per source and retrieve flattened list. */
export interface CommandRegistry {
	setCommands: (source: string, commands: CommandOption[]) => void;
	removeSource: (source: string) => void;
	getAllCommands: () => CommandOption[];
}

export type { CommandOption };
