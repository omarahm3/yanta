import "@wailsio/runtime";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
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
}

enableBackendLogging();

// Apply cached theme before React mount to avoid FOUC. Config-backed value
// hydrates inside ThemeInit and overwrites the cache.
try {
	const cached = localStorage.getItem("yanta_theme_cache");
	const mode = cached === "dark" || cached === "light" || cached === "system" ? cached : "system";
	const resolved =
		mode === "system"
			? window.matchMedia?.("(prefers-color-scheme: light)").matches
				? "light"
				: "dark"
			: mode;
	document.documentElement.setAttribute("data-theme", resolved);
} catch {
	// ignore — ThemeInit will set the attribute once mounted
}

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
