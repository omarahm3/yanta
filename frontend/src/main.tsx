import "@wailsio/runtime";
import "@fontsource-variable/geist";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { App, CrashBoundary } from "@/app";
import { ReducedEffectsInit } from "@/shared/stores/appearance.store";
import { ThemeInit } from "@/shared/stores/theme.store";
import { HotkeyProvider } from "./hotkeys";
import { QuickCapture } from "./quick-capture";
import { ToastProvider } from "./shared/ui";
import { BackendLogger, enableBackendLogging } from "./shared/utils/backendLogger";
import { installProductionLockdown } from "./shared/utils/productionLockdown";
import "./styles/tailwind.css";
import "./styles/yanta.css";

interface YantaDebug {
	jsLoaded?: number;
	[key: string]: unknown;
}

declare global {
	interface Window {
		__YANTA_DEBUG__?: YantaDebug;
	}
}

if (typeof window !== "undefined") {
	window.__YANTA_DEBUG__ = window.__YANTA_DEBUG__ || {};
	window.__YANTA_DEBUG__.jsLoaded = Date.now();

	// Excalidraw loads its custom fonts (Excalifont, ComicShanns, Xiaolai, …) at
	// runtime, relative to window.EXCALIDRAW_ASSET_PATH; when unset it fetches them
	// from Excalidraw's CDN, which breaks in a packaged/offline desktop build. In
	// production we self-host them: the Vite build copies the fonts into dist/fonts
	// (see vite.config excalidrawFonts plugin) and Wails serves them at /fonts, so
	// point the asset path at the app root. Dev is left on Excalidraw's default,
	// which the Vite dev server already resolves, so this can't regress dev.
	// Set before any lazy Excalidraw chunk evaluates (this entry runs first).
	if (import.meta.env.PROD) {
		(window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = "/";
	}
}

enableBackendLogging();

// Disable native right-click menu and reload/devtools keys in production so the
// packaged app behaves identically on Windows, macOS, and Linux. No-op in dev.
installProductionLockdown();

const container = document.getElementById("root");

if (!container) {
	BackendLogger.error("[main.tsx] CRITICAL: Root container not found!");
	throw new Error("Root container not found");
}

const root = createRoot(container);

const isQuickCapture = new URLSearchParams(window.location.search).get("mode") === "quick-capture";
BackendLogger.info("[main.tsx] Mode:", "isQuickCapture:", isQuickCapture);

if (isQuickCapture) {
	root.render(
		<React.StrictMode>
			<CrashBoundary>
				<ToastProvider>
					<HotkeyProvider>
						<ThemeInit />
						<ReducedEffectsInit />
						<QuickCapture />
					</HotkeyProvider>
				</ToastProvider>
			</CrashBoundary>
		</React.StrictMode>,
	);
} else {
	root.render(
		<React.StrictMode>
			<CrashBoundary>
				<App />
			</CrashBoundary>
		</React.StrictMode>,
	);
}

BackendLogger.info("[main.tsx] App rendered successfully");
