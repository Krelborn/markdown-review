import { fileURLToPath } from "node:url";

import { build } from "vite";

/**
 * Builds `dist/cli.js` once before the integration tests, which run it as the agent would
 */
export default async function buildCli(): Promise<void> {
  await build({ configFile: fileURLToPath(new URL("../../../vite.config.mts", import.meta.url)), logLevel: "warn" });
}
