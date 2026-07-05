import { describe, expect, it } from "vitest";
import { installPluginHost, PLUGIN_HOST_GLOBAL_KEY } from "../pluginHost";

describe("plugin host ABI", () => {
	it("installs a frozen, narrowed host contract", () => {
		const host = installPluginHost();

		expect(host.React).toBeDefined();
		expect(host.BlockNoteCore).toBeDefined();
		expect(host.BlockNoteReact).toBeDefined();
		expect(host.JSXRuntime).toBeDefined();
		expect(host.JSXDevRuntime).toBeDefined();
		expect(Object.isFrozen(host)).toBe(true);

		// Escape-hatch runtimes are intentionally NOT exposed anymore.
		const surface = host as unknown as Record<string, unknown>;
		expect(surface.ReactDOM).toBeUndefined();
		expect(surface.ReactDOMClient).toBeUndefined();
		expect(surface.Yjs).toBeUndefined();
	});

	it("pins the global as non-writable and non-configurable", () => {
		installPluginHost();

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, PLUGIN_HOST_GLOBAL_KEY);
		expect(descriptor).toBeDefined();
		expect(descriptor?.writable).toBe(false);
		expect(descriptor?.configurable).toBe(false);
	});

	it("is idempotent and cannot be swapped once installed", () => {
		const first = installPluginHost();
		expect(installPluginHost()).toBe(first);

		const globalObject = globalThis as Record<string, unknown>;
		expect(() => {
			globalObject[PLUGIN_HOST_GLOBAL_KEY] = { hijacked: true };
		}).toThrow();
		expect(installPluginHost()).toBe(first);
	});
});
