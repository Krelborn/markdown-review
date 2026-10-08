import { blockAtOffset } from "./blockAtOffset";
import type { DocumentText } from "./DocumentText";

/**
 * Finds the source line holding a character of a doc's canonical text
 *
 * @param documentText the doc's canonical text
 * @param offset a position in the canonical text; the "\n" between two blocks belongs to the earlier block
 * @returns the 1-based source line, or 1 when the doc has no blocks; never later than the true line
 */
export function lineAtOffset(documentText: DocumentText, offset: number): number {
  const position = blockAtOffset(documentText, offset);
  if (position === null) {
    return 1;
  }
  const { block, offsetInBlock } = position;
  return block.lineOffsets.findLast((lineOffset) => lineOffset.offset <= offsetInBlock)?.line ?? block.startLine;
}
