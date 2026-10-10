import { createHash } from "node:crypto";

import { anchoringVersion } from "../../shared/markdown/anchoringVersion";

/**
 * Fingerprints a doc's source under the current canonical-text rules, so the store can tell when anchors were computed
 * against an older version of either
 *
 * @param source the markdown source
 * @returns the SHA-256 of the anchoring version, a newline and the source, as 64 lowercase hex digits
 */
export function hashSource(source: string): string {
  return createHash("sha256").update(`${anchoringVersion}\n${source}`, "utf8").digest("hex");
}
