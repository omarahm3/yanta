import * as BlockNoteCoreRuntime from "@blocknote/core";
import * as BlockNoteReactRuntime from "@blocknote/react";
import * as ReactRuntime from "react";
import { useEffect, useRef } from "react";
import * as JSXDevRuntime from "react/jsx-dev-runtime";
import * as JSXRuntime from "react/jsx-runtime";
import * as ReactDOMRuntime from "react-dom";
import * as ReactDOMClientRuntime from "react-dom/client";
import * as YjsRuntime from "yjs";
import { usePreferencesStore } from "@/shared/stores/preferences.store";
import { registerBuiltInPlugins } from "./bootstrap";
import { loadEnabledPlugins, registerInstalledPlugins } from "./registry";

function initializePluginHostRuntime(): void {
	const host = globalThis as Record<string, unknown>;
	host.__YANTA_PLUGIN_HOST__ = {
		...(host.__YANTA_PLUGIN_HOST__ as Record<string, unknown> | undefined),
		React: ReactRuntime,
		ReactDOM: ReactDOMRuntime,
		ReactDOMClient: ReactDOMClientRuntime,
		JSXRuntime,
		JSXDevRuntime,
		BlockNoteCore: BlockNoteCoreRuntime,
		BlockNoteReact: BlockNoteReactRuntime,
		Yjs: YjsRuntime,
	};
}

export function PluginBootstrap() {
	const isLoadingPreferences = usePreferencesStore((s) => s.isLoading);
	const hasStartedRef = useRef(false);

	useEffect(() => {
		initializePluginHostRuntime();
		registerBuiltInPlugins();
	}, []);

	useEffect(() => {
		if (isLoadingPreferences || hasStartedRef.current) return;
		hasStartedRef.current = true;
		void (async () => {
			await registerInstalledPlugins();
			await loadEnabledPlugins();
		})();
	}, [isLoadingPreferences]);

	return null;
}
