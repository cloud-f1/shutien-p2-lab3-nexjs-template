import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.npm_lifecycle_event === "build" ? "/docs/" : "/",
  plugins: [react()],
  server: { port: 4000 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
  },
});
