import { createDocumentText } from "../../shared/markdown/createDocumentText";
import type { Thread } from "../../shared/review/threadSchema";

import { reanchorPassage } from "./reanchorPassage";

/**
 * Brings the passage threads of a doc up to date with its source
 *
 * @param threads the doc's threads, of any status
 * @param source the doc's current source, or null when the doc no longer exists
 * @returns the threads with every passage anchor moved to its text, or marked outdated; other threads unchanged
 */
export function reanchorDocumentThreads(threads: readonly Thread[], source: string | null): Thread[] {
  const documentText = source === null ? null : createDocumentText(source);
  return threads.map((thread) => {
    if (thread.anchor.kind !== "passage") {
      return thread;
    }
    const anchor =
      documentText === null ? { ...thread.anchor, outdated: true } : reanchorPassage(thread.anchor, documentText);
    return { ...thread, anchor };
  });
}
