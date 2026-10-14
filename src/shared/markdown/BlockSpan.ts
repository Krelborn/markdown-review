/**
 * A run of a doc's blocks, by their indexes as `data-md-block` gives them, inclusive
 */
export interface BlockSpan {
  firstBlock: number;
  lastBlock: number;
}
