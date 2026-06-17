import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Inline (empty) PostCSS config so Vite skips loading postcss.config.mjs,
  // which pulls in @tailwindcss/postcss -> lightningcss (whose platform-specific
  // native binary npm ci drops on Linux). Component tests don't render compiled
  // Tailwind, so they need no PostCSS at all.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
