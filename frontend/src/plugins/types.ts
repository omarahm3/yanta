import type { z } from "zod";
import type { CommandOption, SidebarSection } from "../shared/ui";
import type { PluginConfigSchema } from "../config";
import type { EditorExtensionContribution } from "../editor/extensions/registry/editorExtensionRegistry";

export type PluginCapability = "commands" | "sidebar" | "editorExtensions" | "settings";

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
	registerConfig: <T>(def: PluginConfigSchema<T>) => void;
}

export interface PluginRuntimeRecord {
	manifest: PluginManifest;
	isActive: boolean;
	lastError?: string;
}

export interface PersistedPluginState {
	enabled: Record<string, boolean>;
}

export type ZodSchema<T> = z.ZodType<T>;
