import type { ReviewRound, Verdict } from "./reviewRoundSchema";

/**
 * Tells how the user ended a review round
 *
 * @param round the round, or null before any review was opened
 * @returns the verdict that ended the round, or null while it goes on
 */
export function roundOutcome(round: ReviewRound | null): Exclude<Verdict, "revise"> | null {
  const kind = round?.verdict?.kind;
  return kind === "go-ahead" || kind === "hand-back" ? kind : null;
}
