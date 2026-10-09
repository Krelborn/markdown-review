import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import type { NewComment } from "./NewComment";

/**
 * Finds the passage of the comment the user is writing, when it is on the given doc
 *
 * @param newComment the comment being written, or null
 * @param documentPath the doc on screen
 * @returns the comment's passage, or null when the comment is on the whole doc, the review or another doc
 */
export function pendingPassageOn(newComment: NewComment | null, documentPath: string): NewPassageAnchor | null {
  const anchor = newComment?.anchor;
  return anchor?.kind === "passage" && anchor.document === documentPath ? anchor : null;
}
