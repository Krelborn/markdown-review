import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./src/e2e/testing/buildPackage.ts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
        locale: "en-US",
        reducedMotion: "reduce",
        viewport: { height: 860, width: 1400 },
      },
    },
  ],
  reporter: "list",
  testDir: "src/screenshots",
  testMatch: "**/*.shots.ts",
  timeout: 60_000,
});
