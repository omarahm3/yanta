import { useCommandRegistryStore } from "../command-palette/registry";
import { type PluginConfigSchema, registerPluginConfig, unregisterPluginConfig } from "@/config/public";
import {
	getAllEditorExtensions,
	removeEditorExtensions,
	setEditorExtensions,
} from "../editor/extensions/registry/editorExtensionRegistry";
import { usePreferencesStore } from "@/shared/stores/preferences.store";
import { useSidebarRegistryStore } from "../sidebar/registry/sidebarRegistry.store";
import type {
	PersistedPluginState,
	PluginAPI,
	PluginDefinition,
	PluginRuntimeRecord,
} from "./types";

const PLUGIN_STATE_ID = "__plugin_state";
const PLUGIN_STATE_ENABLED_KEY = "enabled";

const definitions = new Map<string, PluginDefinition>();
const cleanups = new Map<string, () => void>();
const runtime = new Map<string, PluginRuntimeRecord>();

function toSource(pluginId: string): string {
	return `plugin:${pluginId}`;
}

function readPersistedState(): PersistedPluginState {
	const overrides = usePreferencesStore.getState().overrides;
	const stateRaw = overrides?.plugins?.[PLUGIN_STATE_ID];
	const enabledRaw = stateRaw?.[PLUGIN_STATE_ENABLED_KEY];
	if (!enabledRaw || typeof enabledRaw !== "object") {
		return { enabled: {} };
	}
	const enabledEntries = Object.entries(enabledRaw as Record<string, unknown>).filter(
		([, val]) => typeof val === "boolean",
	);
	return { enabled: Object.fromEntries(enabledEntries) as Record<string, boolean> };
}

async function writePersistedState(state: PersistedPluginState): Promise<void> {
	const store = usePreferencesStore.getState();
	const current = store.overrides?.plugins?.[PLUGIN_STATE_ID];
	const merged = {
		...(current ?? {}),
		[PLUGIN_STATE_ENABLED_KEY]: state.enabled,
	};
	await store.saveOverrides({
		plugins: {
			[PLUGIN_STATE_ID]: merged,
		},
	});
}

function createPluginAPI(pluginId: string): PluginAPI {
	const source = toSource(pluginId);
	const registerConfigForPlugin = <T>(def: PluginConfigSchema<T>): void => {
		registerPluginConfig(pluginId, def);
	};

	return {
		registerCommands: (commands) => {
			useCommandRegistryStore.getState().setCommands(source, commands);
		},
		registerSidebarSections: (sections) => {
			useSidebarRegistryStore.getState().setSections(source, sections);
		},
		registerEditorExtensions: (extensions) => {
			setEditorExtensions(source, extensions);
		},
		registerConfig: registerConfigForPlugin,
	};
}

function cleanupPluginContributions(pluginId: string): void {
	const source = toSource(pluginId);
	useCommandRegistryStore.getState().removeSource(source);
	useSidebarRegistryStore.getState().removeSource(source);
	removeEditorExtensions(source);
	unregisterPluginConfig(pluginId);
}

function setRuntime(pluginId: string, patch: Partial<PluginRuntimeRecord>): void {
	const def = definitions.get(pluginId);
	if (!def) return;
	const prev = runtime.get(pluginId) ?? {
		manifest: def.manifest,
		isActive: false,
	};
	runtime.set(pluginId, { ...prev, ...patch });
}

export function registerPlugin(definition: PluginDefinition): void {
	definitions.set(definition.manifest.id, definition);
	setRuntime(definition.manifest.id, {
		manifest: definition.manifest,
		isActive: false,
		lastError: undefined,
	});
}

export function listPlugins(): PluginRuntimeRecord[] {
	return Array.from(runtime.values()).sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

export async function loadPlugin(pluginId: string): Promise<void> {
	const def = definitions.get(pluginId);
	if (!def) return;
	if (cleanups.has(pluginId)) return;

	const api = createPluginAPI(pluginId);
	try {
		const maybeCleanup = await def.setup(api);
		const cleanup =
			typeof maybeCleanup === "function"
				? maybeCleanup
				: () => {
						cleanupPluginContributions(pluginId);
					};
		cleanups.set(pluginId, () => {
			try {
				cleanup();
			} finally {
				cleanupPluginContributions(pluginId);
			}
		});
		setRuntime(pluginId, { isActive: true, lastError: undefined });
	} catch (err) {
		cleanupPluginContributions(pluginId);
		const message = err instanceof Error ? err.message : String(err);
		setRuntime(pluginId, { isActive: false, lastError: message });
	}
}

export function unloadPlugin(pluginId: string): void {
	const cleanup = cleanups.get(pluginId);
	if (cleanup) {
		cleanup();
		cleanups.delete(pluginId);
	} else {
		cleanupPluginContributions(pluginId);
	}
	setRuntime(pluginId, { isActive: false });
}

export async function enablePlugin(pluginId: string): Promise<void> {
	const state = readPersistedState();
	state.enabled[pluginId] = true;
	await writePersistedState(state);
	await loadPlugin(pluginId);
}

export async function disablePlugin(pluginId: string): Promise<void> {
	const state = readPersistedState();
	state.enabled[pluginId] = false;
	await writePersistedState(state);
	unloadPlugin(pluginId);
}

export async function loadEnabledPlugins(): Promise<void> {
	const state = readPersistedState();
	const allDefs = Array.from(definitions.values()).sort((a, b) =>
		a.manifest.id.localeCompare(b.manifest.id),
	);
	for (const def of allDefs) {
		const enabled = state.enabled[def.manifest.id] ?? true;
		if (enabled) {
			await loadPlugin(def.manifest.id);
		} else {
			unloadPlugin(def.manifest.id);
		}
	}
}

export function getRegisteredEditorExtensionCount(): number {
	return getAllEditorExtensions().length;
}

export function __resetPluginRegistryForTests(): void {
	for (const id of Array.from(cleanups.keys())) {
		unloadPlugin(id);
	}
	definitions.clear();
	cleanups.clear();
	runtime.clear();
}

