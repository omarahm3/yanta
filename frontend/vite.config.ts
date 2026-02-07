import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import tailwindcss from "@tailwindcss/vite";
import wails from "@wailsio/runtime/plugins/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.YANTA_ENABLE_TOOLTIP_HINTS": JSON.stringify(
      process.env.YANTA_ENABLE_TOOLTIP_HINTS === "true",
    ),
  },
  plugins: [
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
    terserOptions: {
      compress: {
        // drop_console: true,
        drop_debugger: true,
        // pure_funcs: ["console.log", "console.info"],
      },
    },

    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          "vendor-react": ["react", "react-dom"],

          // BlockNote editor (very heavy - separate chunk)
          "vendor-blocknote": [
            "@blocknote/core",
            "@blocknote/react",
            "@blocknote/shadcn",
          ],

          // Utilities
          "vendor-utils": [
            "clsx",
            "class-variance-authority",
            "tailwind-merge",
          ],
        },
      },
    },

    chunkSizeWarningLimit: 500,
    sourcemap: false,
    cssCodeSplit: true,
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ["react", "react-dom", "@blocknote/react"],
  },
});
