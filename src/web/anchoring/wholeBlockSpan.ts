import type { BlockSpan } from "../../shared/markdown/BlockSpan";
import type { DocumentText } from "../../shared/markdown/DocumentText";

/**
 * Finds the blocks whose whole text a passage covers, as a comment started from the gutter does
 *
 * @param documentText the doc's canonical text
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 * @returns the first and last block, or null when the passage does not start at one block's start and end at the same
 *   or a later block's end
 */
export function wholeBlockSpan(documentText: DocumentText, startOffset: number, endOffset: number): BlockSpan | null {
  const { blocks, blockStartOffsets } = documentText;
  const firstBlock = blockStartOffsets.indexOf(startOffset);
  if (firstBlock === -1) {
    return null;
  }
  const lastBlock = blocks.findIndex(
    (block, index) => index >= firstBlock && (blockStartOffsets[index] ?? 0) + block.text.length === endOffset
  );
  return lastBlock === -1 ? null : { firstBlock, lastBlock };
}
