import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: process.env.CI !== undefined,
  globalSetup: "./src/e2e/testing/buildPackage.ts",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  reporter: process.env.CI === undefined ? "list" : "github",
  testDir: "src/e2e",
  testMatch: "**/*.e2e.ts",
});
