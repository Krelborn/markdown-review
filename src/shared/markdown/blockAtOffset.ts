import type { BlockPosition } from "./BlockPosition";
import type { DocumentText } from "./DocumentText";

/**
 * Finds the block holding a character of a doc's canonical text
 *
 * @param documentText the doc's canonical text
 * @param offset a position in the canonical text; the "\n" between two blocks belongs to the earlier block
 * @returns the block and the position within its text, clamped to the text's length, or null when the doc has no
 *   blocks
 */
export function blockAtOffset(documentText: DocumentText, offset: number): BlockPosition | null {
  const { blocks, blockStartOffsets } = documentText;
  let blockIndex = blocks.length - 1;
  while (blockIndex > 0 && (blockStartOffsets[blockIndex] ?? 0) > offset) {
    blockIndex -= 1;
  }
  const block = blocks[blockIndex];
  if (block === undefined) {
    return null;
  }
  return {
    block,
    offsetInBlock: Math.min(Math.max(0, offset - (blockStartOffsets[blockIndex] ?? 0)), block.text.length),
  };
}
