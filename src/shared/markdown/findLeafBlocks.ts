import type { Token } from "markdown-it";

import type { LeafBlock, LeafBlockKind } from "./LeafBlock";

const leafBlockKinds: Partial<Record<string, LeafBlockKind>> = {
  code_block: "codeBlock",
  fence: "fence",
  heading_open: "inline",
  html_block: "htmlBlock",
  paragraph_open: "inline",
  tr_open: "tableRow",
};

/**
 * Finds the leaf blocks of a parsed doc
 *
 * @param tokens the token stream markdown-it parsed from `source`
 * @param source the markdown source
 * @returns the leaf blocks in document order
 */
export function findLeafBlocks(tokens: readonly Token[], source: string): LeafBlock[] {
  const sourceLines = source.split(/\r\n?|\n/);
  const leafBlocks: LeafBlock[] = [];
  tokens.forEach((token, tokenIndex) => {
    const kind = leafBlockKinds[token.type];
    if (kind === undefined || token.map === null) {
      return;
    }
    const [lineBegin, lineEnd] = token.map;
    leafBlocks.push({
      endLine: lastLineWithText(sourceLines, lineBegin, lineEnd),
      kind,
      startLine: lineBegin + 1,
      token,
      tokenIndex,
    });
  });
  return leafBlocks;
}

function lastLineWithText(sourceLines: readonly string[], lineBegin: number, lineEnd: number): number {
  let endLine = lineEnd;
  while (endLine > lineBegin + 1 && (sourceLines[endLine - 1] ?? "").trim() === "") {
    endLine -= 1;
  }
  return endLine;
}
