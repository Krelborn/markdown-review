import type { Token } from "markdown-it";

import type { BlockSpan } from "./BlockSpan";
import type { DocumentStructure } from "./DocumentStructure";
import type { LeafBlock } from "./LeafBlock";

const containerKinds: Partial<Record<string, "alert" | "list" | "quote" | "table">> = {
  alert_open: "alert",
  blockquote_open: "quote",
  bullet_list_open: "list",
  ordered_list_open: "list",
  table_open: "table",
};

const containerCloseTypes = new Set([
  "alert_close",
  "blockquote_close",
  "bullet_list_close",
  "ordered_list_close",
  "table_close",
]);

interface OpenContainer {
  /**
   * The first leaf block after the container's opening token
   */
  firstBlock: number;

  kind: "alert" | "list" | "quote" | "table";
  token: Token;
}

interface OpenSection {
  firstBlock: number;
  rank: number;
}

/**
 * Finds the tables, lists, quotes, alerts and heading sections of a parsed doc
 *
 * @param tokens the token stream markdown-it parsed the doc into
 * @param leafBlocks the doc's leaf blocks, as `findLeafBlocks` finds them in the tokens
 * @returns the structures of two or more blocks, in the order they start, each before those inside it. A section is a
 *   heading outside every list, quote and alert, with the blocks under it up to the next such heading of the same or a
 *   higher rank.
 */
export function findStructures(tokens: readonly Token[], leafBlocks: readonly LeafBlock[]): DocumentStructure[] {
  return [...findContainers(tokens, leafBlocks), ...findSections(leafBlocks)]
    .filter(({ firstBlock, lastBlock }) => lastBlock > firstBlock)
    .sort((left, right) => left.firstBlock - right.firstBlock || right.lastBlock - left.lastBlock);
}

function findContainers(tokens: readonly Token[], leafBlocks: readonly LeafBlock[]): DocumentStructure[] {
  const blocksBefore = countBlocksBefore(tokens.length, leafBlocks);
  const open: OpenContainer[] = [];
  const containers: DocumentStructure[] = [];
  tokens.forEach((token, tokenIndex) => {
    const kind = containerKinds[token.type];
    if (kind !== undefined) {
      open.push({ firstBlock: blocksBefore[tokenIndex + 1] ?? 0, kind, token });
      return;
    }
    const opening = containerCloseTypes.has(token.type) ? open.pop() : undefined;
    const lastBlock = (blocksBefore[tokenIndex] ?? 0) - 1;
    if (opening !== undefined && lastBlock >= opening.firstBlock) {
      containers.push(toContainer(opening, { firstBlock: opening.firstBlock, lastBlock }));
    }
  });
  return containers;
}

/**
 * @returns for each token index from 0 to the number of tokens, how many leaf blocks open on a token before it
 */
function countBlocksBefore(tokenCount: number, leafBlocks: readonly LeafBlock[]): number[] {
  const counts = Array.from({ length: tokenCount + 1 }, () => 0);
  for (const { tokenIndex } of leafBlocks) {
    counts[tokenIndex + 1] = (counts[tokenIndex + 1] ?? 0) + 1;
  }
  for (let i = 1; i < counts.length; i += 1) {
    counts[i] = (counts[i] ?? 0) + (counts[i - 1] ?? 0);
  }
  return counts;
}

function toContainer({ kind, token }: OpenContainer, span: BlockSpan): DocumentStructure {
  return kind === "alert"
    ? { ...span, alertKind: token.markup, depth: token.level, kind }
    : { ...span, depth: token.level, kind };
}

function findSections(leafBlocks: readonly LeafBlock[]): DocumentStructure[] {
  const open: OpenSection[] = [];
  const sections: DocumentStructure[] = [];
  const close = (lastBlock: number): void => {
    const section = open.pop();
    if (section !== undefined) {
      sections.push({ depth: 0, firstBlock: section.firstBlock, kind: "section", lastBlock });
    }
  };
  leafBlocks.forEach(({ token }, index) => {
    if (token.type !== "heading_open" || token.level !== 0) {
      return;
    }
    const rank = Number(token.tag.slice(1));
    while ((open.at(-1)?.rank ?? 0) >= rank) {
      close(index - 1);
    }
    open.push({ firstBlock: index, rank });
  });
  while (open.length > 0) {
    close(leafBlocks.length - 1);
  }
  return sections;
}
