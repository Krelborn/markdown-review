import type { DocumentText } from "./DocumentText";
import { parseBlocks } from "./parseBlocks";

/**
 * Builds the canonical text of a doc
 *
 * @param source the markdown source
 * @returns the doc's blocks, their joined text and where each block starts in it
 */
export function createDocumentText(source: string): DocumentText {
  const blocks = parseBlocks(source);
  const blockStartOffsets: number[] = [];
  let offset = 0;
  for (const block of blocks) {
    blockStartOffsets.push(offset);
    offset += block.text.length + 1;
  }
  return { blockStartOffsets, blocks, text: blocks.map((block) => block.text).join("\n") };
}
