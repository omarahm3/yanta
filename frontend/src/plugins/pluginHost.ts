import * as BlockNoteCore from "@blocknote/core";
import * as BlockNoteReact from "@blocknote/react";
import * as React from "react";
import * as JSXDevRuntime from "react/jsx-dev-runtime";
import * as JSXRuntime from "react/jsx-runtime";

export const PLUGIN_HOST_GLOBAL_KEY = "__YANTA_PLUGIN_HOST__";

/**
 * The runtime contract exposed to external plugins. Deliberately minimal: only
 * the shared singletons a plugin needs to author editor contributions (block
 * specs / extensions) against the SAME React and BlockNote instances as the
 * host. The previous host handed out the full ReactDOM / ReactDOMClient / Yjs
 * runtime — an unnecessary escape hatch (nothing here mounts its own React tree)
 * and a wider permanent lock-in surface.
 */
export interface PluginHost {
	readonly React: typeof React;
	readonly JSXRuntime: typeof JSXRuntime;
	readonly JSXDevRuntime: typeof JSXDevRuntime;
	readonly BlockNoteCore: typeof BlockNoteCore;
	readonly BlockNoteReact: typeof BlockNoteReact;
}

/**
 * Installs the plugin host onto `globalThis` exactly once as a frozen,
 * non-writable, non-configurable property. Freezing prevents a loaded plugin
 * from swapping a runtime (e.g. replacing `React` to hijack every other
 * plugin/editor), and non-configurable stops the whole contract being
 * redefined. Idempotent: repeat calls return the already-installed host.
 */
export function installPluginHost(): PluginHost {
	const globalObject = globalThis as Record<string, unknown>;
	const existing = globalObject[PLUGIN_HOST_GLOBAL_KEY];
	if (existing) {
		return existing as PluginHost;
	}

	const host: PluginHost = Object.freeze({
		React,
		JSXRuntime,
		JSXDevRuntime,
		BlockNoteCore,
		BlockNoteReact,
	});

	Object.defineProperty(globalObject, PLUGIN_HOST_GLOBAL_KEY, {
		value: host,
		writable: false,
		configurable: false,
		enumerable: false,
	});

	return host;
}
