import type { ReviewRound } from "./reviewRoundSchema";
import type { Thread } from "./threadSchema";

/**
 * Tells whether a submit sends a thread's draft
 *
 * @param thread the thread
 * @param round the current round, or null before any review was opened
 * @returns false when the thread has no draft; otherwise true when there is no round, or the draft is on the whole
 *   review, on a doc opened this round, or written since the round began
 */
export function isDraftInRound(thread: Thread, round: ReviewRound | null): boolean {
  if (thread.draft === undefined) {
    return false;
  }
  if (round === null || thread.anchor.kind === "review") {
    return true;
  }
  return round.documents.includes(thread.anchor.document) || Date.parse(thread.draft.at) >= Date.parse(round.startedAt);
}
