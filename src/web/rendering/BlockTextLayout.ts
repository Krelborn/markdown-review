export interface TextSegment {
  node: Text;

  /**
   * The offset in the block's canonical text where the node's text starts
   */
  offset: number;
}

/**
 * A rendered block's canonical text and the DOM text nodes it is read from
 */
export interface BlockTextLayout {
  text: string;
  segments: TextSegment[];
}
