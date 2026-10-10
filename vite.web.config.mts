import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    license: { fileName: "licences.md" },
    outDir: fileURLToPath(new URL("dist/web", import.meta.url)),
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  root: fileURLToPath(new URL("src/web", import.meta.url)),
});
