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
  kind: "alert" | "list" | "quote" | "table";
  token: Token;
  tokenIndex: number;
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
  const open: OpenContainer[] = [];
  const containers: DocumentStructure[] = [];
  tokens.forEach((token, tokenIndex) => {
    const kind = containerKinds[token.type];
    if (kind !== undefined) {
      open.push({ kind, token, tokenIndex });
      return;
    }
    const opening = containerCloseTypes.has(token.type) ? open.pop() : undefined;
    const span = opening === undefined ? null : blocksBetween(leafBlocks, opening.tokenIndex, tokenIndex);
    if (opening !== undefined && span !== null) {
      containers.push(toContainer(opening, span));
    }
  });
  return containers;
}

function toContainer({ kind, token }: OpenContainer, span: BlockSpan): DocumentStructure {
  return kind === "alert"
    ? { ...span, alertKind: token.markup, depth: token.level, kind }
    : { ...span, depth: token.level, kind };
}

function findSections(leafBlocks: readonly LeafBlock[]): DocumentStructure[] {
  const headings = leafBlocks.flatMap(({ token }, index) =>
    token.type === "heading_open" && token.level === 0 ? [{ index, rank: Number(token.tag.slice(1)) }] : []
  );
  return headings.map(({ index, rank }, position) => {
    const next = headings.slice(position + 1).find((heading) => heading.rank <= rank);
    return { depth: 0, firstBlock: index, kind: "section", lastBlock: (next?.index ?? leafBlocks.length) - 1 };
  });
}

/**
 * @returns the leaf blocks whose tokens lie between two tokens, or null when none do
 */
function blocksBetween(leafBlocks: readonly LeafBlock[], openIndex: number, closeIndex: number): BlockSpan | null {
  const firstBlock = leafBlocks.findIndex(({ tokenIndex }) => tokenIndex > openIndex);
  const lastBlock = leafBlocks.findLastIndex(({ tokenIndex }) => tokenIndex < closeIndex);
  return firstBlock === -1 || lastBlock < firstBlock ? null : { firstBlock, lastBlock };
}
