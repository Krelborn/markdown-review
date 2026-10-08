import type { MarkdownBlock } from "./MarkdownBlock";

/**
 * Where a character of a doc's canonical text falls
 */
export interface BlockPosition {
  block: MarkdownBlock;
  offsetInBlock: number;
}
