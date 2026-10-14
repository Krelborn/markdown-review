import { createMarkdownIt } from "./createMarkdownIt";
import type { DocumentText } from "./DocumentText";
import { findLeafBlocks } from "./findLeafBlocks";
import { findStructures } from "./findStructures";
import { blocksFromTokens } from "./parseBlocks";

const markdown = createMarkdownIt();

/**
 * Builds the canonical text of a doc
 *
 * @param source the markdown source
 * @returns the doc's blocks, their joined text, where each block starts in it, and the structures the blocks make up
 */
export function createDocumentText(source: string): DocumentText {
  const tokens = markdown.parse(source, {});
  const leafBlocks = findLeafBlocks(tokens, source);
  const blocks = blocksFromTokens(tokens, leafBlocks, source);
  const blockStartOffsets: number[] = [];
  let offset = 0;
  for (const block of blocks) {
    blockStartOffsets.push(offset);
    offset += block.text.length + 1;
  }
  return {
    blockStartOffsets,
    blocks,
    structures: findStructures(tokens, leafBlocks),
    text: blocks.map((block) => block.text).join("\n"),
  };
}
