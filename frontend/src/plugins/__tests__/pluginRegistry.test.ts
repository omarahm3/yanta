import { createExtension } from "@blocknote/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandRegistryStore } from "../../command-palette/registry";
import {
	getAllEditorBlockActions,
	getAllEditorBlockSpecs,
	getAllEditorExtensions,
	getAllEditorLifecycleHooks,
	getAllEditorSlashMenuItems,
	getAllEditorStyleSpecs,
	getAllEditorTipTapExtensions,
	getAllEditorTools,
} from "../../editor/extensions/registry/editorExtensionRegistry";
import { useSidebarRegistryStore } from "../../sidebar/registry/sidebarRegistry.store";
import {
	__resetPluginRegistryForTests,
	listPlugins,
	loadEnabledPlugins,
	registerInstalledPlugins,
	registerPlugin,
	unloadPlugin,
} from "../registry";
import type { PluginDefinition } from "../types";

const {
	getSupportedPluginAPIMajorMock,
	getCommunityPluginsEnabledMock,
	listInstalledMock,
	readPluginEntrypointMock,
} = vi.hoisted(() => ({
	getSupportedPluginAPIMajorMock: vi.fn(async () => 1),
	getCommunityPluginsEnabledMock: vi.fn(async () => true),
	listInstalledMock: vi.fn(async () => []),
	readPluginEntrypointMock: vi.fn(async () => ""),
}));

vi.mock("../../../bindings/yanta/internal/plugins/wailsservice", () => ({
	GetCommunityPluginsEnabled: getCommunityPluginsEnabledMock,
	GetSupportedPluginAPIMajor: getSupportedPluginAPIMajorMock,
	ListInstalled: listInstalledMock,
	ReadPluginEntrypoint: readPluginEntrypointMock,
}));

describe("plugin registry", () => {
	beforeEach(() => {
		getSupportedPluginAPIMajorMock.mockReset();
		getSupportedPluginAPIMajorMock.mockResolvedValue(1);
		getCommunityPluginsEnabledMock.mockReset();
		getCommunityPluginsEnabledMock.mockResolvedValue(true);
		listInstalledMock.mockReset();
		listInstalledMock.mockResolvedValue([]);
		readPluginEntrypointMock.mockReset();
		readPluginEntrypointMock.mockResolvedValue("");
		__resetPluginRegistryForTests();
		useCommandRegistryStore.setState({ sources: {} });
		useSidebarRegistryStore.setState({ sources: {} });
	});

	it("loads and unloads plugin contributions", async () => {
		const plugin: PluginDefinition = {
			manifest: {
				id: "test.plugin",
				name: "Test Plugin",
				version: "1.0.0",
				apiVersion: "1",
				entry: "builtin:test-plugin",
				capabilities: [
					"commands",
					"sidebar",
					"editorExtensions",
					"editorTipTapExtensions",
					"editorBlockSpecs",
					"editorStyleSpecs",
					"editorSlashMenu",
					"editorTools",
					"editorBlockActions",
					"editorLifecycle",
				],
			},
			setup: (api) => {
				api.registerCommands([
					{
						id: "test-plugin-command",
						text: "Test command",
						group: "Plugins",
						action: () => {},
					},
				]);
				api.registerSidebarSections([
					{
						id: "test-plugin-section",
						title: "PLUGINS",
						items: [{ id: "test-plugin-item", label: "plugin item" }],
					},
				]);
				api.registerEditorExtensions([createExtension({ key: "test.plugin.extension" })]);
				api.registerEditorTipTapExtensions([
					{} as unknown as ReturnType<typeof getAllEditorTipTapExtensions>[number],
				]);
				api.registerEditorBlockSpecs({ pluginBlock: {} } as unknown as ReturnType<
					typeof getAllEditorBlockSpecs
				>);
				api.registerEditorStyleSpecs({ pluginStyle: {} } as unknown as ReturnType<
					typeof getAllEditorStyleSpecs
				>);
				api.registerEditorSlashMenuItems([
					{
						title: "Plugin slash action",
						aliases: ["plugin"],
						group: "Plugins",
						onItemClick: () => {},
					},
				]);
				api.registerEditorTools([
					{
						id: "tool.test",
						label: "Tool Test",
						action: () => {},
					},
				]);
				api.registerEditorBlockActions([
					{
						id: "block-action.test",
						label: "Block Action Test",
						action: () => {},
					},
				]);
				api.registerEditorLifecycleHooks({
					onEditorReady: () => {},
				});
			},
		};

		registerPlugin(plugin);
		await loadEnabledPlugins();

		expect(useCommandRegistryStore.getState().sources["plugin:test.plugin"]).toHaveLength(1);
		expect(useSidebarRegistryStore.getState().sources["plugin:test.plugin"]).toHaveLength(1);
		expect(getAllEditorExtensions().length).toBeGreaterThan(0);
		expect(getAllEditorTipTapExtensions()).toHaveLength(1);
		expect(Object.keys(getAllEditorBlockSpecs())).toContain("pluginBlock");
		expect(Object.keys(getAllEditorStyleSpecs())).toContain("pluginStyle");
		expect(getAllEditorSlashMenuItems()).toHaveLength(1);
		expect(getAllEditorTools()).toHaveLength(1);
		expect(getAllEditorBlockActions()).toHaveLength(1);
		expect(getAllEditorLifecycleHooks()).toHaveLength(1);

		unloadPlugin("test.plugin");

		expect(useCommandRegistryStore.getState().sources["plugin:test.plugin"]).toBeUndefined();
		expect(useSidebarRegistryStore.getState().sources["plugin:test.plugin"]).toBeUndefined();
		expect(getAllEditorExtensions()).toEqual([]);
		expect(getAllEditorTipTapExtensions()).toEqual([]);
		expect(getAllEditorBlockSpecs()).toEqual({});
		expect(getAllEditorStyleSpecs()).toEqual({});
		expect(getAllEditorSlashMenuItems()).toEqual([]);
		expect(getAllEditorTools()).toEqual([]);
		expect(getAllEditorBlockActions()).toEqual([]);
		expect(getAllEditorLifecycleHooks()).toEqual([]);
	});

	it("blocks external plugins when community plugins are disabled", async () => {
		getCommunityPluginsEnabledMock.mockResolvedValueOnce(false);
		registerPlugin({
			manifest: {
				id: "external.plugin",
				name: "External Plugin",
				version: "1.0.0",
				apiVersion: "1",
				entry: "main.js",
				capabilities: ["editorExtensions"],
			},
			setup: () => {},
		});

		await loadEnabledPlugins();
		const runtime = listPlugins().find((item) => item.manifest.id === "external.plugin");
		expect(runtime).toBeDefined();
		expect(runtime?.isActive).toBe(false);
		expect(runtime?.lastError).toContain("Community plugins are disabled");
		expect(runtime?.isolationMode).toBe("external_local");
	});

	it("blocks incompatible plugin API major versions", async () => {
		registerPlugin({
			manifest: {
				id: "old.api.plugin",
				name: "Old API Plugin",
				version: "1.0.0",
				apiVersion: "2",
				entry: "builtin:old-api-plugin",
				capabilities: ["editorExtensions"],
			},
			setup: () => {},
		});

		await loadEnabledPlugins();
		const runtime = listPlugins().find((item) => item.manifest.id === "old.api.plugin");
		expect(runtime).toBeDefined();
		expect(runtime?.isActive).toBe(false);
		expect(runtime?.lastError).toContain("Unsupported plugin API version");
	});

	it("uses backend-supported plugin API major dynamically", async () => {
		getSupportedPluginAPIMajorMock.mockResolvedValueOnce(2);
		registerPlugin({
			manifest: {
				id: "v2.plugin",
				name: "V2 Plugin",
				version: "1.0.0",
				apiVersion: "2",
				entry: "builtin:v2-plugin",
				capabilities: ["editorExtensions"],
			},
			setup: () => {},
		});

		await loadEnabledPlugins();
		const runtime = listPlugins().find((item) => item.manifest.id === "v2.plugin");
		expect(runtime).toBeDefined();
		expect(runtime?.isActive).toBe(true);
		expect(runtime?.lastError).toBeUndefined();
	});

	it("loads installed external plugins", async () => {
		listInstalledMock.mockResolvedValueOnce([
			{
				manifest: {
					ID: "external.signed",
					Name: "External Signed",
					Version: "1.0.0",
					APIVersion: "1",
					Entry: "main.js",
					Capabilities: ["commands"],
					Description: "",
					Author: "",
					Homepage: "",
				},
				path: "/plugins/external.signed",
				source: "package",
				enabled: true,
				status: "ok",
				canExecute: true,
			},
		]);
		readPluginEntrypointMock.mockResolvedValueOnce(`
export function setup(api) {
	api.registerCommands([
		{
			id: "external-command",
			text: "External command",
			group: "Plugins",
			action: () => {},
		},
	]);
}
`);

		await registerInstalledPlugins();
		await loadEnabledPlugins();

		expect(useCommandRegistryStore.getState().sources["plugin:external.signed"]).toHaveLength(1);
		const runtime = listPlugins().find((item) => item.manifest.id === "external.signed");
		expect(runtime?.isolationMode).toBe("external_local");
		expect(runtime?.isActive).toBe(true);
	});

	it("blocks a register call for a capability the manifest did not declare", async () => {
		registerPlugin({
			manifest: {
				id: "least.privilege",
				name: "Least Privilege",
				version: "1.0.0",
				apiVersion: "1",
				entry: "builtin:least-privilege",
				capabilities: ["commands"],
			},
			setup: (api) => {
				api.registerEditorBlockSpecs({ sneaky: {} } as unknown as ReturnType<
					typeof getAllEditorBlockSpecs
				>);
			},
		});

		await loadEnabledPlugins();

		const runtime = listPlugins().find((item) => item.manifest.id === "least.privilege");
		expect(runtime?.isActive).toBe(false);
		expect(runtime?.lastError).toContain("editorBlockSpecs");
		expect(Object.keys(getAllEditorBlockSpecs())).not.toContain("sneaky");
	});

	it("allows a register call for a declared capability", async () => {
		registerPlugin({
			manifest: {
				id: "declared.caps",
				name: "Declared Caps",
				version: "1.0.0",
				apiVersion: "1",
				entry: "builtin:declared-caps",
				capabilities: ["commands"],
			},
			setup: (api) => {
				api.registerCommands([
					{ id: "declared-command", text: "Declared", group: "Plugins", action: () => {} },
				]);
			},
		});

		await loadEnabledPlugins();

		const runtime = listPlugins().find((item) => item.manifest.id === "declared.caps");
		expect(runtime?.isActive).toBe(true);
		expect(useCommandRegistryStore.getState().sources["plugin:declared.caps"]).toHaveLength(1);
	});

	it("rejects an installed plugin whose manifest fails validation", async () => {
		listInstalledMock.mockResolvedValueOnce([
			{
				manifest: {
					ID: "bad id!",
					Name: "Bad Manifest",
					Version: "1.0.0",
					APIVersion: "1",
					Entry: "main.js",
					Capabilities: ["commands"],
					Description: "",
					Author: "",
					Homepage: "",
				},
				path: "/plugins/bad",
				source: "package",
				enabled: true,
				status: "ok",
				canExecute: true,
			},
		]);

		await registerInstalledPlugins();
		await loadEnabledPlugins();

		const runtime = listPlugins().find((item) => item.manifest.id === "bad id!");
		expect(runtime).toBeDefined();
		expect(runtime?.isActive).toBe(false);
		expect(runtime?.lastError).toContain("validation");
		expect(readPluginEntrypointMock).not.toHaveBeenCalled();
	});
});
