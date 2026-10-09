/**
 * Where a block of the rendered doc is, relative to the view that holds the doc and its controls
 */
export interface BlockBox {
  height: number;

  /**
   * The block's index, as its `data-md-block` gives it
   */
  index: number;

  left: number;
  top: number;
  width: number;
}
