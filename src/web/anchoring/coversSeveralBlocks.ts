import type { DocumentText } from "../../shared/markdown/DocumentText";

import { wholeBlockSpan } from "./wholeBlockSpan";

/**
 * Tells whether a passage is the whole text of two or more blocks, which the view frames rather than highlights
 *
 * @param documentText the doc's canonical text
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 */
export function coversSeveralBlocks(documentText: DocumentText, startOffset: number, endOffset: number): boolean {
  const span = wholeBlockSpan(documentText, startOffset, endOffset);
  return span !== null && span.lastBlock > span.firstBlock;
}
