import { createHash } from "node:crypto";

const firstDynamicPort = 49152;

const dynamicPortCount = 16384;

/**
 * Picks the port a root's server tries first, so a restarted server usually comes back on the same port
 *
 * @param root the repo root
 * @returns a port in the dynamic range 49152-65535, the same for the same root
 */
export function preferredPort(root: string): number {
  const digest = createHash("sha256").update(root, "utf8").digest();
  return firstDynamicPort + (digest.readUInt32BE(0) % dynamicPortCount);
}
