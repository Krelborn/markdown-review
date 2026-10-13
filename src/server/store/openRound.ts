import type { ReviewRound } from "../../shared/review/reviewRoundSchema";
import { roundOutcome } from "../../shared/review/roundOutcome";

const roundExpiryMilliseconds = 12 * 60 * 60 * 1000;

/**
 * Adds a doc to the review round going on, or starts the next round
 *
 * @param round the current round, or null before any review was opened
 * @param path the doc the agent opened, or null for the docs list
 * @param nextTask what the agent will do once the user says go ahead, or null to keep what the round has
 * @param at the current time, ISO 8601
 * @returns the round joined when it has not ended and had an open or a submit in the last 12 hours, otherwise a new
 *   round, which starts when the previous one ended if that was in the last 12 hours
 */
export function openRound(
  round: ReviewRound | null,
  path: string | null,
  nextTask: string | null,
  at: string
): ReviewRound {
  if (round !== null && roundOutcome(round) === null && isRecent(lastActivity(round), at)) {
    return {
      ...round,
      documents: path === null || round.documents.includes(path) ? round.documents : [...round.documents, path],
      lastOpenedAt: at,
      nextTask: nextTask ?? round.nextTask,
    };
  }
  const previousEnd = round !== null && roundOutcome(round) !== null ? (round.verdict?.at ?? null) : null;
  return {
    documents: path === null ? [] : [path],
    lastOpenedAt: at,
    nextTask,
    startedAt: previousEnd !== null && isRecent(previousEnd, at) ? previousEnd : at,
    verdict: null,
  };
}

function lastActivity({ lastOpenedAt, verdict }: ReviewRound): string {
  return verdict !== null && Date.parse(verdict.at) > Date.parse(lastOpenedAt) ? verdict.at : lastOpenedAt;
}

function isRecent(earlier: string, at: string): boolean {
  return Date.parse(at) - Date.parse(earlier) < roundExpiryMilliseconds;
}
