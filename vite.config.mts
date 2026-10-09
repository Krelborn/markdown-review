import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Marks the CLI executable, which `npm link` needs because it symlinks the bin without setting its mode. */
const executableCli = (): Plugin => ({
  name: "executable-cli",
  async writeBundle(options) {
    await chmod(join(options.dir ?? "dist", "cli.js"), 0o755);
  },
});

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: { output: { entryFileNames: "cli.js" } },
    ssr: "src/cli/main.ts",
    target: "node22",
  },
  plugins: [executableCli()],
});
