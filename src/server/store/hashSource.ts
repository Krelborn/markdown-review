import { createHash } from "node:crypto";

/**
 * Fingerprints a doc's source so the store can tell when anchors were computed against an older version
 *
 * @param source the markdown source
 * @returns the SHA-256 of the source, as 64 lowercase hex digits
 */
export function hashSource(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}
