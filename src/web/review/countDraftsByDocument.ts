import type { Thread } from "../../shared/review/threadSchema";

export interface DraftCount {
  count: number;

  /**
   * The doc's path, or null for drafts on the whole review
   */
  document: string | null;
}

/**
 * Counts the new comments and replies the user has not yet submitted on each doc
 *
 * @returns the review's drafts first, then each doc's in path order; docs without drafts are left out
 */
export function countDraftsByDocument(threads: readonly Thread[]): DraftCount[] {
  const counts = new Map<string | null, number>();
  for (const { anchor, draft } of threads) {
    if (draft !== undefined) {
      const document = anchor.kind === "review" ? null : anchor.document;
      counts.set(document, (counts.get(document) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([document, count]) => ({ count, document }))
    .sort((left, right) => (left.document ?? "").localeCompare(right.document ?? ""));
}
