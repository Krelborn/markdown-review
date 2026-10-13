import type { BlockSpan } from "../../shared/markdown/BlockSpan";
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import { passageAnchor } from "./passageAnchor";

/**
 * Builds the anchor of a comment on whole blocks, whose quote is the blocks' whole text
 *
 * @param documentText the doc's canonical text
 * @param documentPath the doc's repo-relative path
 * @param span the blocks, the first no later than the last
 * @returns the anchor, from the first block's start to the last block's end, or null when the doc has no such blocks
 */
export function blockPassage(
  documentText: DocumentText,
  documentPath: string,
  { firstBlock, lastBlock }: BlockSpan
): NewPassageAnchor | null {
  const start = documentText.blockStartOffsets[firstBlock];
  const lastStart = documentText.blockStartOffsets[lastBlock];
  const last = documentText.blocks[lastBlock];
  if (start === undefined || lastStart === undefined || last === undefined) {
    return null;
  }
  return passageAnchor(documentText, documentPath, start, lastStart + last.text.length);
}
