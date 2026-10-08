import type { Thread } from "../../shared/review/threadSchema";

/**
 * Tells whether a thread is waiting for the agent
 *
 * @param thread the thread
 * @returns true when the thread is open and the user had the last word
 */
export function needsAgent(thread: Thread): boolean {
  return thread.status === "open" && thread.messages.at(-1)?.author === "user";
}
