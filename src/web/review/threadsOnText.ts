import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { Thread } from "../../shared/review/threadSchema";
import { coversSeveralBlocks } from "../anchoring/coversSeveralBlocks";

/**
 * Picks the threads the doc highlights in its text, which a pointer over the text hovers and a click selects
 *
 * @param documentText the doc's canonical text
 * @param threads the threads whose passages the doc shows
 * @returns every thread but those whose passage is the whole text of two or more blocks, which a bar beside the blocks
 *   shows instead
 */
export function threadsOnText(documentText: DocumentText, threads: readonly Thread[]): Thread[] {
  return threads.filter(
    ({ anchor }) =>
      anchor.kind !== "passage" || !coversSeveralBlocks(documentText, anchor.startOffset, anchor.endOffset)
  );
}
