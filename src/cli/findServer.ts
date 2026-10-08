import type { Health } from "../shared/api/apiResponseSchemas";
import { protocolVersion } from "../shared/api/protocolVersion";
import { serverFileSchema } from "../server/runtime/serverFileSchema";
import { readStoreFile } from "../server/store/readStoreFile";
import { serverFilePath } from "../server/store/storePaths";

import { ServerClient } from "./ServerClient";

export type FoundServer =
  | { kind: "absent" }
  | { kind: "ready"; client: ServerClient }
  | { kind: "older"; client: ServerClient }
  | { kind: "newer"; health: Health };

/**
 * Looks for a server already serving the root, using `.markdown-review/server.json`
 *
 * @param root the root's real path
 * @returns "ready" for a healthy server of this protocol, "older" or "newer" for one of another protocol, and
 *   "absent" when there is no record, the recorded server does not answer, or it serves another root
 */
export async function findServer(root: string): Promise<FoundServer> {
  const recorded = await readStoreFile(serverFilePath(root), serverFileSchema);
  if (recorded.kind === "invalid" || recorded.value === null) {
    return { kind: "absent" };
  }
  const client = new ServerClient(recorded.value.port, recorded.value.token);
  let health: Health;
  try {
    health = await client.health();
  } catch {
    return { kind: "absent" };
  }
  if (health.root !== root) {
    return { kind: "absent" };
  }
  if (health.protocol < protocolVersion) {
    return { client, kind: "older" };
  }
  return health.protocol > protocolVersion ? { health, kind: "newer" } : { client, kind: "ready" };
}
