import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { enableBackendLogging } from "./utils/backendLogger";

if (typeof window !== "undefined") {
  (window as any).__YANTA_DEBUG__ = (window as any).__YANTA_DEBUG__ || {};
  (window as any).__YANTA_DEBUG__.jsLoaded = Date.now();
}

enableBackendLogging();

const container = document.getElementById("root");

if (!container) {
  console.error("[main.tsx] CRITICAL: Root container not found!");
  throw new Error("Root container not found");
}

const root = createRoot(container!);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log("[main.tsx] App rendered successfully");
} catch (error) {
  console.error("[main.tsx] CRITICAL ERROR rendering App:", error);
  throw error;
}
