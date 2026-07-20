import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type BuildOptions, type Plugin } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "path";

// Copy Excalidraw's runtime fonts (Excalifont, ComicShanns, Xiaolai, …) into the
// build output at dist/fonts. Excalidraw fetches them relative to
// window.EXCALIDRAW_ASSET_PATH (set to "/" in production, see src/main.tsx); Wails
// embeds and serves dist at the app root, so /fonts/<Family>/<file>.woff2 resolves
// offline instead of hitting Excalidraw's CDN. Build-only; dev uses Excalidraw's
// default which the Vite dev server already resolves.
function excalidrawFonts(): Plugin {
	const require = createRequire(import.meta.url);
	// package.json isn't in the package's exports map; resolve the entry instead.
	const entry = require.resolve("@excalidraw/excalidraw");
	const fontsDir = path.join(path.dirname(entry), "fonts");
	return {
		name: "excalidraw-fonts",
		apply: "build",
		writeBundle(outputOptions) {
			const outDir = outputOptions.dir ?? path.resolve(__dirname, "dist");
			const dest = path.join(outDir, "fonts");
			if (!fs.existsSync(fontsDir)) {
				// A production build sets EXCALIDRAW_ASSET_PATH="/" (see src/main.tsx),
				// so shipping without these fonts serves /fonts/... 404s to users with
				// no CDN fallback. Fail the build (this hook is build-only) instead of
				// only warning, so a missing-fonts regression can't reach production.
				this.error(`excalidraw fonts dir not found at ${fontsDir}; cannot bundle canvas fonts`);
			}
			fs.cpSync(fontsDir, dest, { recursive: true });
		},
	};
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	define: {
		"import.meta.env.YANTA_ENABLE_TOOLTIP_HINTS": JSON.stringify(
			process.env.YANTA_ENABLE_TOOLTIP_HINTS === "true",
		),
		"import.meta.env.YANTA_ENABLE_PLUGINS": JSON.stringify(
			process.env.YANTA_ENABLE_PLUGINS === "true",
		),
		"import.meta.env.YANTA_ENABLE_APP_MONITOR": JSON.stringify(
			process.env.YANTA_ENABLE_APP_MONITOR === "true",
		),
		"import.meta.env.YANTA_ENABLE_COMMAND_LINE": JSON.stringify(
			process.env.YANTA_ENABLE_COMMAND_LINE === "true",
		),
	},
	plugins: [
		{
			name: "wails-custom-js-404",
			apply: "serve",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (!req.url) {
						next();
						return;
					}

					if (req.url.startsWith("/wails/custom.js")) {
						res.statusCode = 404;
						res.setHeader("Content-Type", "text/plain; charset=utf-8");
						res.end("Not found");
						return;
					}

					next();
				});
			},
		},
		react(),
		tailwindcss(),
		wails("./bindings"),
		excalidrawFonts(),
		visualizer({
			open: false,
			gzipSize: true,
			brotliSize: true,
			filename: "dist/stats.html",
		}),
	],

	resolve: {
		alias: {
			"@/app": path.resolve(__dirname, "./src/app/index.ts"),
			"@": path.resolve(__dirname, "./src"),
		},
		dedupe: ["@blocknote/core", "@blocknote/react"],
	},

	server: {
		// Bind IPv4 explicitly. Vite otherwise listens on IPv6 (::1), but the Wails
		// dev proxy dials localhost -> 127.0.0.1 (IPv4), so it can't reach Vite -> 502.
		host: "127.0.0.1",
		port: Number(process.env.WAILS_VITE_PORT) || 34115,
		strictPort: true,
		// Wails' dev webview serves from the wails.localhost host and proxies here;
		// Vite 7's host allow-list must include it or proxied requests are rejected.
		allowedHosts: ["localhost", "wails.localhost"],
	},

	build: {
		target: "es2020",
		minify: "terser",
		// Production ships with devtools disabled (see productionLockdown), so the
		// sourcemaps are unusable in the shipped app — they only bloat the binary
		// (~42MB embedded via go:embed) and filled the macOS runner during DMG
		// creation. Keep them for dev builds, drop them from production.
		sourcemap: mode === "production" ? false : "hidden",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ["console.log", "console.info"],
			},
		} as BuildOptions["terserOptions"],

		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom"],
					"vendor-blocknote": ["@blocknote/core", "@blocknote/react", "@blocknote/shadcn"],
					"vendor-utils": ["clsx", "class-variance-authority", "tailwind-merge"],
					"vendor-excalidraw": ["@excalidraw/excalidraw"],
				},
			},
		},

		chunkSizeWarningLimit: 500,
		cssCodeSplit: true,
	},

	optimizeDeps: {
		// Crawl app source at startup so deps are pre-bundled in one pass, but
		// exclude test files — pulling vitest/@testing-library into the dev dep
		// cache bloats it and invites mid-session re-optimization/reload churn.
		entries: [
			"index.html",
			"src/**/*.{ts,tsx}",
			"!src/**/*.{test,spec}.{ts,tsx}",
			"!src/**/__tests__/**",
		],
		include: [
			"react",
			"react-dom",
			"@blocknote/react",
			"@blocknote/core",
			"@blocknote/core/extensions",
			"@blocknote/shadcn",
			"@blocknote/code-block",
			"@excalidraw/excalidraw",
		],
	},
}));
