import "@wailsio/runtime";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { CrashBoundary } from "@/app/CrashBoundary";
import { ReducedEffectsInit } from "@/shared/stores/appearance.store";
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
