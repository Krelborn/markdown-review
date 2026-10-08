import type { Thread } from "../../shared/review/threadSchema";

/**
 * Finds the thread whose passage holds a character of its doc, for a click on highlighted text
 *
 * @param threads the threads whose passages are highlighted
 * @param offset the character's offset in the doc's canonical text
 * @returns the thread with the shortest passage that holds the character or ends just before it, or null
 */
export function threadAtOffset(threads: readonly Thread[], offset: number): Thread | null {
  let found: Thread | null = null;
  let foundLength = Infinity;
  for (const thread of threads) {
    const { anchor } = thread;
    if (anchor.kind === "passage" && anchor.startOffset <= offset && offset <= anchor.endOffset) {
      const length = anchor.endOffset - anchor.startOffset;
      if (length < foundLength) {
        found = thread;
        foundLength = length;
      }
    }
  }
  return found;
}
