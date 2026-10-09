import type { DocumentSource } from "../../shared/api/apiResponseSchemas";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import type { NewComment } from "./NewComment";

/**
 * Finds the passage of the comment the user is writing, when it is on the doc on screen as that doc was when the
 * comment started
 *
 * @param newComment the comment being written, or null
 * @param shown the path and hash of the doc on screen
 * @returns the comment's passage, or null when the comment is on the whole doc, the review or another doc, or the doc
 *   has changed since, which leaves the passage's offsets pointing at other text
 */
export function pendingPassageOn(
  newComment: NewComment | null,
  shown: Pick<DocumentSource, "hash" | "path">
): NewPassageAnchor | null {
  const anchor = newComment?.anchor;
  const isOnShown = anchor?.kind === "passage" && anchor.document === shown.path;
  return isOnShown && newComment?.renderedHash === shown.hash ? anchor : null;
}
