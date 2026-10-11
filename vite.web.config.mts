import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Below these, lightningcss rewrites StylesUI's light-dark() into variables that colour modes cannot change
    cssTarget: ["chrome123", "edge123", "firefox120", "safari17.5"],
    emptyOutDir: true,
    license: { fileName: "licences.md" },
    outDir: fileURLToPath(new URL("dist/web", import.meta.url)),
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  root: fileURLToPath(new URL("src/web", import.meta.url)),
});
