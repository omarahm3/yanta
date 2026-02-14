import type { z } from "zod";
import type { PluginConfigSchema } from "../config";
import type {
	EditorBlockActionContribution,
	EditorBlockSpecContribution,
	EditorExtensionContribution,
	EditorLifecycleHooks,
	EditorSlashMenuItemContribution,
	EditorStyleSpecContribution,
	EditorTipTapExtensionContribution,
	EditorToolContribution,
} from "../editor/extensions/registry/editorExtensionRegistry";
import type { CommandOption, SidebarSection } from "../shared/ui";

export type PluginCapability =
	| "commands"
	| "sidebar"
	| "editorExtensions"
	| "editorTipTapExtensions"
	| "editorBlockSpecs"
	| "editorStyleSpecs"
	| "editorSlashMenu"
	| "editorTools"
	| "editorBlockActions"
	| "editorLifecycle"
	| "settings";

export type PluginIsolationMode = "builtin_trusted" | "external_local";

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
	apiVersion: string;
	entry: string;
	capabilities: PluginCapability[];
	description?: string;
	author?: string;
	homepage?: string;
}

export interface PluginDefinition {
	manifest: PluginManifest;
	setup: (api: PluginAPI) => void | (() => void) | Promise<void | (() => void)>;
}

export interface PluginAPI {
	registerCommands: (commands: CommandOption[]) => void;
	registerSidebarSections: (sections: SidebarSection[]) => void;
	registerEditorExtensions: (extensions: EditorExtensionContribution[]) => void;
	registerEditorTipTapExtensions: (extensions: EditorTipTapExtensionContribution[]) => void;
	registerEditorBlockSpecs: (blockSpecs: EditorBlockSpecContribution) => void;
	registerEditorStyleSpecs: (styleSpecs: EditorStyleSpecContribution) => void;
	registerEditorSlashMenuItems: (items: EditorSlashMenuItemContribution[]) => void;
	registerEditorTools: (tools: EditorToolContribution[]) => void;
	registerEditorBlockActions: (actions: EditorBlockActionContribution[]) => void;
	registerEditorLifecycleHooks: (hooks: EditorLifecycleHooks) => void;
	registerConfig: <T>(def: PluginConfigSchema<T>) => void;
}

export interface PluginRuntimeRecord {
	manifest: PluginManifest;
	isolationMode: PluginIsolationMode;
	isActive: boolean;
	lastError?: string;
}

export interface PersistedPluginState {
	enabled: Record<string, boolean>;
}

export type ZodSchema<T> = z.ZodType<T>;
