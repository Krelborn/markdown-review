import type { ReviewRound, Verdict } from "./reviewRoundSchema";

export type RoundOutcome = Exclude<Verdict, "revise">;

/**
 * Tells how the user ended a review round
 *
 * @param round the round, or null before any review was opened
 * @returns the verdict that ended the round, or null while it goes on
 */
export function roundOutcome(round: ReviewRound | null): RoundOutcome | null {
  const kind = round?.verdict?.kind;
  return kind === "go-ahead" || kind === "hand-back" ? kind : null;
}
