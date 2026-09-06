import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow extra dev hosts (e.g. tunnelled previews) via a comma-separated env var.
    allowedHosts: process.env.VITE_ALLOWED_HOSTS === "all" ? true : (process.env.VITE_ALLOWED_HOSTS?.split(",").filter(Boolean) ?? []),
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
