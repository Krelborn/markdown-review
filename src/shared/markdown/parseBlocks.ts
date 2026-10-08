import type { Token } from "markdown-it";

import { createMarkdownIt } from "./createMarkdownIt";
import { fenceLanguage } from "./fenceLanguage";
import { findLeafBlocks } from "./findLeafBlocks";
import { inlineText } from "./inlineText";
import type { LeafBlock } from "./LeafBlock";
import type { LineOffset, MarkdownBlock } from "./MarkdownBlock";
import { tokenAt } from "./tokenAt";
import { withoutFinalNewline } from "./withoutFinalNewline";

const markdown = createMarkdownIt();

/**
 * Splits a doc into the leaf blocks comments anchor to
 *
 * @param source the markdown source
 * @returns the leaf blocks in document order, each with its canonical text
 */
export function parseBlocks(source: string): MarkdownBlock[] {
  const tokens = markdown.parse(source, {});
  return findLeafBlocks(tokens, source).map((leafBlock) => toMarkdownBlock(tokens, leafBlock));
}

function toMarkdownBlock(tokens: readonly Token[], leafBlock: LeafBlock): MarkdownBlock {
  const { endLine, kind, startLine, token, tokenIndex } = leafBlock;
  switch (kind) {
    case "inline": {
      const { lineStartOffsets, text } = inlineText(tokenAt(tokens, tokenIndex + 1).children ?? []);
      const lineOffsets = [0, ...lineStartOffsets].map((offset, index) => ({ line: startLine + index, offset }));
      const isSetextHeading = token.markup === "=" || token.markup === "-";
      const textLineCount = endLine - startLine + (isSetextHeading ? 0 : 1);
      const exactLines = lineOffsets.length === textLineCount;
      return { endLine, exactLines, lineOffsets, startLine, text, wholeBlockOnly: false };
    }
    case "tableRow": {
      const text = tableRowCells(tokens, tokenIndex).join("\t");
      const lineOffsets = [{ line: startLine, offset: 0 }];
      return { endLine, exactLines: true, lineOffsets, startLine, text, wholeBlockOnly: false };
    }
    case "fence": {
      const text = withoutFinalNewline(token.content);
      const wholeBlockOnly = fenceLanguage(token.info) === "mermaid";
      const lineOffsets = codeLineOffsets(text, startLine + 1, endLine);
      return { endLine, exactLines: true, lineOffsets, startLine, text, wholeBlockOnly };
    }
    case "codeBlock":
    case "htmlBlock": {
      const text = withoutFinalNewline(token.content);
      const wholeBlockOnly = kind === "htmlBlock";
      const lineOffsets = codeLineOffsets(text, startLine, endLine);
      return { endLine, exactLines: true, lineOffsets, startLine, text, wholeBlockOnly };
    }
  }
}

function tableRowCells(tokens: readonly Token[], rowTokenIndex: number): string[] {
  const cells: string[] = [];
  for (let index = rowTokenIndex + 1; index < tokens.length; index++) {
    const token = tokenAt(tokens, index);
    if (token.type === "tr_close") {
      break;
    }
    if (token.type === "inline") {
      cells.push(inlineText(token.children ?? []).text);
    }
  }
  return cells;
}

function codeLineOffsets(text: string, firstLine: number, lastLine: number): LineOffset[] {
  if (text === "") {
    return [];
  }
  const lineOffsets: LineOffset[] = [{ line: firstLine, offset: 0 }];
  for (let offset = text.indexOf("\n"); offset !== -1; offset = text.indexOf("\n", offset + 1)) {
    lineOffsets.push({ line: firstLine + lineOffsets.length, offset: offset + 1 });
  }
  return lineOffsets.filter(({ line }) => line <= lastLine);
}
