import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type BuildOptions } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
	},

	server: {
		port: Number(process.env.WAILS_VITE_PORT) || 34115,
		strictPort: true,
	},

	build: {
		target: "es2020",
		minify: "terser",
		sourcemap: "hidden",
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
				},
			},
		},

		chunkSizeWarningLimit: 500,
		cssCodeSplit: true,
	},

	optimizeDeps: {
		include: ["react", "react-dom", "@blocknote/react"],
	},
});
