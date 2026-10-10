import type { DocumentText } from "../../shared/markdown/DocumentText";

/**
 * Finds the block whose whole text a passage covers, as a comment started with + beside a block does
 *
 * @param documentText the doc's canonical text
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 * @returns the block's index, or null when the passage is not exactly one block's text
 */
export function wholeBlockIndex(documentText: DocumentText, startOffset: number, endOffset: number): number | null {
  const index = documentText.blockStartOffsets.indexOf(startOffset);
  const block = documentText.blocks[index];
  return block !== undefined && startOffset + block.text.length === endOffset ? index : null;
}
