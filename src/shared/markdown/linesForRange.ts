import { blockAtOffset } from "./blockAtOffset";
import type { DocumentText } from "./DocumentText";
import { lineAtOffset } from "./lineAtOffset";
import type { LineRange } from "./LineRange";

/**
 * Finds the source lines holding a range of a doc's canonical text
 *
 * @param documentText the doc's canonical text
 * @param startOffset where the range starts
 * @param endOffset where the range ends, exclusive
 * @returns the lines holding the first and last characters of the range; when a block's lines are not exact, the range
 *   runs to the end of that block, so it always contains the text
 */
export function linesForRange(documentText: DocumentText, startOffset: number, endOffset: number): LineRange {
  const lastOffset = Math.max(startOffset, endOffset - 1);
  const lastBlock = blockAtOffset(documentText, lastOffset)?.block;
  return {
    endLine: lastBlock?.exactLines === false ? lastBlock.endLine : lineAtOffset(documentText, lastOffset),
    startLine: lineAtOffset(documentText, startOffset),
  };
}
