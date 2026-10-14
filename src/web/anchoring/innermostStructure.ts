import type { DocumentStructure } from "../../shared/markdown/DocumentStructure";
import type { DocumentText } from "../../shared/markdown/DocumentText";

/**
 * Finds the structure the gutter offers beside a block, for a comment on all of it
 *
 * @param documentText the doc's canonical text and structures
 * @param blockIndex the block's index, as its `data-md-block` gives it
 * @returns for a heading, its section; for any other block, the structure around it with the fewest blocks, and of two
 *   with the same blocks, the one nested deeper; or null when no structure holds the block
 */
export function innermostStructure({ structures }: DocumentText, blockIndex: number): DocumentStructure | null {
  const ownSection = structures.find(({ firstBlock, kind }) => kind === "section" && firstBlock === blockIndex);
  if (ownSection !== undefined) {
    return ownSection;
  }
  const around = structures.filter(({ firstBlock, lastBlock }) => firstBlock <= blockIndex && blockIndex <= lastBlock);
  return around.reduce<DocumentStructure | null>((innermost, structure) => {
    if (innermost === null) {
      return structure;
    }
    const sizeDifference = blockCount(structure) - blockCount(innermost);
    return sizeDifference < 0 || (sizeDifference === 0 && structure.depth > innermost.depth) ? structure : innermost;
  }, null);
}

function blockCount({ firstBlock, lastBlock }: DocumentStructure): number {
  return lastBlock - firstBlock + 1;
}
