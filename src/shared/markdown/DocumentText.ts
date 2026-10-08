import type { MarkdownBlock } from "./MarkdownBlock";

/**
 * A doc's canonical text: its blocks' texts joined with "\n"; anchor offsets are positions in `text`
 */
export interface DocumentText {
  text: string;
  blocks: MarkdownBlock[];

  /**
   * The offset in `text` where each block starts
   */
  blockStartOffsets: number[];
}
