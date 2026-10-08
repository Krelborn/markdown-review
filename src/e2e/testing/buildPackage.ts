import { fileURLToPath } from "node:url";

import { build } from "vite";

/**
 * Builds the CLI and the web app once before the end-to-end tests, which run the package as a user would
 */
export default async function buildPackage(): Promise<void> {
  for (const config of ["vite.config.mts", "vite.web.config.mts"]) {
    await build({ configFile: fileURLToPath(new URL(`../../../${config}`, import.meta.url)), logLevel: "warn" });
  }
}
