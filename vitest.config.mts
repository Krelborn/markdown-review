import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: ["src/**/*.d.ts"],
      include: ["src/**/*.{ts,tsx}"],
      // fallow reads coverage/coverage-final.json without being asked, which would make commit checks depend on a stale
      // local report, so the json report goes under another name and `fallow health --coverage` is pointed at it
      reporter: ["text-summary", ["json", { file: "istanbul.json" }]],
    },
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "node",
          include: ["src/cli/**/*.test.ts", "src/server/**/*.test.ts", "src/shared/**/*.test.ts"],
          name: "node",
        },
      },
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "node",
          globalSetup: ["src/integration/testing/buildCli.ts"],
          include: ["src/integration/**/*.test.ts"],
          name: "integration",
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "jsdom",
          include: ["src/web/**/*.test.{ts,tsx}"],
          name: "web",
          // StylesUI's modules import their own CSS, which Node cannot load, so Vite must transform them
          server: { deps: { inline: [/@krelborn\/stylesui/] } },
          setupFiles: ["src/web/testing/setup.ts"],
        },
      },
    ],
  },
});
