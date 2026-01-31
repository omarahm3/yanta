import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DialogProvider, HotkeyProvider } from "./contexts";
import { QuickCapture } from "./routes/QuickCapture";
import { enableBackendLogging } from "./utils/backendLogger";
import "./styles/tailwind.css";
import "./styles/yanta.css";

interface YantaDebug {
	jsLoaded?: number;
	[key: string]: unknown;
}

interface WailsEnvironment {
	OS: string;
	Arch: string;
	Debug: boolean;
}

declare global {
	interface Window {
		__YANTA_DEBUG__?: YantaDebug;
		_wails?: {
			environment?: WailsEnvironment;
		};
	}
}

if (typeof window !== "undefined") {
	window.__YANTA_DEBUG__ = window.__YANTA_DEBUG__ || {};
	window.__YANTA_DEBUG__.jsLoaded = Date.now();
}

enableBackendLogging();

async function waitForWailsRuntime(): Promise<void> {
	const maxAttempts = 100;
	const delayMs = 50;

	for (let i = 0; i < maxAttempts; i++) {
		if (window._wails?.environment) {
			console.log("[main.tsx] Wails runtime ready:", window._wails.environment);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	console.error("[main.tsx] Wails runtime not initialized after timeout, proceeding anyway");
	window._wails = window._wails || {};
	window._wails.environment = window._wails.environment || {
		OS: "unknown",
		Arch: "unknown",
		Debug: false,
	};
}

const container = document.getElementById("root");

if (!container) {
	console.error("[main.tsx] CRITICAL: Root container not found!");
	throw new Error("Root container not found");
}

const root = createRoot(container);

waitForWailsRuntime().then(() => {
	try {
		// Check if we're in Quick Capture window based on URL path
		const isQuickCapture = window.location.pathname === "/quick-capture";
		console.log("[main.tsx] Path:", window.location.pathname, "isQuickCapture:", isQuickCapture);

		if (isQuickCapture) {
			// Render minimal Quick Capture UI without main app chrome (providers needed for useHotkeys)
			root.render(
				<React.StrictMode>
					<DialogProvider>
						<HotkeyProvider>
							<QuickCapture />
						</HotkeyProvider>
					</DialogProvider>
				</React.StrictMode>,
			);
			console.log("[main.tsx] QuickCapture rendered successfully");
		} else {
			// Render full application
			root.render(
				<React.StrictMode>
					<App />
				</React.StrictMode>,
			);
			console.log("[main.tsx] App rendered successfully");
		}
	} catch (error) {
		console.error("[main.tsx] CRITICAL ERROR rendering App:", error);
		throw error;
	}
});
