import type { Thread } from "../../shared/review/threadSchema";

/**
 * @returns how many new comments and replies the user has not yet submitted
 */
export function countDrafts(threads: readonly Thread[]): number {
  return threads.filter((thread) => thread.draft !== undefined).length;
}
