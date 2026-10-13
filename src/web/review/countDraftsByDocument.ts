import { isDraftInRound } from "../../shared/review/isDraftInRound";
import type { ReviewRound } from "../../shared/review/reviewRoundSchema";
import type { Thread } from "../../shared/review/threadSchema";

export interface DraftCount {
  count: number;

  /**
   * The doc's path, or null for drafts on the whole review
   */
  document: string | null;
}

export interface DraftCounts {
  /**
   * The drafts a submit leaves as drafts, because they are from before the review round on docs it has not opened
   */
  kept: DraftCount[];

  /**
   * The drafts a submit sends
   */
  sent: DraftCount[];
}

/**
 * Counts the new comments and replies the user has not yet submitted on each doc
 *
 * @param threads every thread in the repo
 * @param round the review round, or null before any review was opened
 * @returns the drafts a submit sends and those it keeps, each with the review's drafts first, then each doc's in path
 *   order; docs without drafts are left out
 */
export function countDraftsByDocument(threads: readonly Thread[], round: ReviewRound | null): DraftCounts {
  const drafts = threads.filter((thread) => thread.draft !== undefined);
  return {
    kept: countByDocument(drafts.filter((thread) => !isDraftInRound(thread, round))),
    sent: countByDocument(drafts.filter((thread) => isDraftInRound(thread, round))),
  };
}

function countByDocument(drafts: readonly Thread[]): DraftCount[] {
  const counts = new Map<string | null, number>();
  for (const { anchor } of drafts) {
    const document = anchor.kind === "review" ? null : anchor.document;
    counts.set(document, (counts.get(document) ?? 0) + 1);
  }
  return [...counts]
    .map(([document, count]) => ({ count, document }))
    .sort((left, right) => (left.document ?? "").localeCompare(right.document ?? ""));
}
