import { describe, expect, it, beforeEach } from "vitest";
import { useCommandRegistryStore } from "../../command-palette/registry";
import { getAllEditorExtensions } from "../../editor/extensions/registry/editorExtensionRegistry";
import { useSidebarRegistryStore } from "../../sidebar/registry/sidebarRegistry.store";
import {
	__resetPluginRegistryForTests,
	loadEnabledPlugins,
	registerPlugin,
	unloadPlugin,
} from "../registry";
import type { PluginDefinition } from "../types";

describe("plugin registry", () => {
	beforeEach(() => {
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
				capabilities: ["commands", "sidebar", "editorExtensions"],
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
				api.registerEditorExtensions([{}]);
			},
		};

		registerPlugin(plugin);
		await loadEnabledPlugins();

		expect(useCommandRegistryStore.getState().sources["plugin:test.plugin"]).toHaveLength(1);
		expect(useSidebarRegistryStore.getState().sources["plugin:test.plugin"]).toHaveLength(1);
		expect(getAllEditorExtensions().length).toBeGreaterThan(0);

		unloadPlugin("test.plugin");

		expect(useCommandRegistryStore.getState().sources["plugin:test.plugin"]).toBeUndefined();
		expect(useSidebarRegistryStore.getState().sources["plugin:test.plugin"]).toBeUndefined();
		expect(getAllEditorExtensions()).toEqual([]);
	});
});
