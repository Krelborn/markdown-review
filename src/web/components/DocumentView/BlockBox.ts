import type { SpanBox } from "./SpanBox";

/**
 * Where a block of the rendered doc is, relative to the view that holds the doc and its controls
 */
export interface BlockBox extends SpanBox {
  /**
   * How far down the middle of the block's first line is, which the + lines up with
   */
  firstLineMiddle: number;

  /**
   * The block's index, as its `data-md-block` gives it
   */
  index: number;
}
