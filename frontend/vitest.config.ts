import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/app": path.resolve(__dirname, "./src/app/index.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    css: false,
    pool: "forks",
    poolOptions: {
      forks: {
        execArgv: ["--max-old-space-size=8192"],
      },
    },
    testTimeout: 5000,
  },
});
