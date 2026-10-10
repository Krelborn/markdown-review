import type { Token } from "markdown-it";

export type LeafBlockKind = "inline" | "tableRow" | "fence" | "codeBlock" | "htmlBlock" | "frontMatter";

/**
 * A token that opens a leaf block, the unit comments anchor to
 */
export interface LeafBlock {
  kind: LeafBlockKind;
  token: Token;
  tokenIndex: number;

  /**
   * 1-based and inclusive, like `endLine`
   */
  startLine: number;

  /**
   * Excludes trailing blank lines, which markdown-it includes in some list items
   */
  endLine: number;
}
