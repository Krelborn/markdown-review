import type { Thread } from "../../shared/review/threadSchema";

/**
 * Tells whether the doc highlights a thread's passage
 *
 * @param selectedThreadId the thread the user has selected, which is highlighted even when resolved
 * @returns true for a passage that is still found in the doc, on a draft or open thread or the selected one
 */
export function isHighlighted({ anchor, id, status }: Thread, selectedThreadId: number | null): boolean {
  return anchor.kind === "passage" && !anchor.outdated && (status !== "resolved" || id === selectedThreadId);
}
