import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import { passageAnchor } from "./passageAnchor";

/**
 * Builds the anchor of a comment on a whole block, whose quote is the block's whole text
 *
 * @param documentText the doc's canonical text
 * @param documentPath the doc's repo-relative path
 * @param blockIndex the block's index, as its `data-md-block` gives it
 * @returns the anchor, or null when the doc has no such block
 */
export function blockPassage(
  documentText: DocumentText,
  documentPath: string,
  blockIndex: number
): NewPassageAnchor | null {
  const start = documentText.blockStartOffsets[blockIndex];
  const block = documentText.blocks[blockIndex];
  if (start === undefined || block === undefined) {
    return null;
  }
  return passageAnchor(documentText, documentPath, start, start + block.text.length);
}
