import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { enableBackendLogging } from "./utils/backendLogger";

// Mark that JavaScript has loaded
if (typeof window !== 'undefined') {
  (window as any).__YANTA_DEBUG__ = (window as any).__YANTA_DEBUG__ || {};
  (window as any).__YANTA_DEBUG__.jsLoaded = Date.now();
}

// Enable backend logging so all console.log goes to the backend log file
enableBackendLogging();

console.log('[main.tsx] Starting YANTA frontend initialization');

const container = document.getElementById("root");

if (!container) {
  console.error('[main.tsx] CRITICAL: Root container not found!');
  throw new Error('Root container not found');
}

console.log('[main.tsx] Root container found, creating React root');

const root = createRoot(container!);

console.log('[main.tsx] React root created, rendering App');

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('[main.tsx] App rendered successfully');
} catch (error) {
  console.error('[main.tsx] CRITICAL ERROR rendering App:', error);
  throw error;
}
