import { readFile } from "node:fs/promises";
import path from "node:path";

import { serverFileSchema } from "../../server/runtime/serverFileSchema";

import { startCli } from "./startCli";

/**
 * Stops a test repository's review server with the CLI, and kills it if it is still running afterwards
 *
 * @param root the repository's root
 */
export async function stopReviewServer(root: string): Promise<void> {
  await startCli(root, ["stop"]).result;
  const recorded = await readFile(path.join(root, ".markdown-review", "server.json"), "utf8")
    .then((contents) => serverFileSchema.parse(JSON.parse(contents)))
    .catch(() => null);
  if (recorded !== null && recorded.pid !== process.pid) {
    try {
      process.kill(recorded.pid);
    } catch {
      return;
    }
  }
}
