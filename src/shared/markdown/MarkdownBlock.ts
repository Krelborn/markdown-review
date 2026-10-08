export interface LineOffset {
  line: number;
  offset: number;
}

/**
 * A leaf block of a doc as both the server and the browser see it
 */
export interface MarkdownBlock {
  /**
   * 1-based and inclusive, like `endLine`
   */
  startLine: number;

  endLine: number;

  /**
   * The block's canonical text: what the browser shows, read from the tokens rather than the DOM
   */
  text: string;

  /**
   * For each source line that contributes text, its 1-based number and the offset in `text` where that line starts
   */
  lineOffsets: LineOffset[];

  /**
   * False when a line break inside a code span, an HTML tag or an image left no trace in `text`, so offsets after it
   * map to an earlier line than the true one
   */
  exactLines: boolean;

  /**
   * True for HTML blocks and Mermaid fences, which take whole-block comments only and whose text is their source
   */
  wholeBlockOnly: boolean;
}
