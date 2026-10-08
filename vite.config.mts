import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: { output: { entryFileNames: "cli.js" } },
    ssr: "src/cli/main.ts",
    target: "node22",
  },
});
