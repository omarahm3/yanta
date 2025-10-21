import type { Project } from "./Project";
import type { Document } from "./Document";

export type { Project, ExtendedProject, ProjectType } from "./Project";
export type {
  Document,
  DocumentWithTags,
  BlockNoteBlock,
  BlockNoteContent,
  DocumentMeta,
  SaveDocumentRequest,
} from "./Document";
export type { Tag } from "./Tag";
export type { SystemInfo, AppInfo, DatabaseInfo } from "./System";
export type {
  HotkeyConfig,
  RegisteredHotkey,
  HotkeyContextValue,
} from "./hotkeys";

// Re-export converters for convenience
export {
  projectFromModel,
  projectsFromModels,
  projectToModel,
  extendProject,
} from "./Project";

export {
  documentFromModel,
  documentWithTagsFromModel,
  documentsFromModels,
  documentToSaveRequest,
} from "./Document";
export { tagFromModel, tagsFromModels, tagToModel } from "./Tag";
export { systemInfoFromModel } from "./System";

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
