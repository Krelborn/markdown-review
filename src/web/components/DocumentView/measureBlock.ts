import type { BlockBox } from "./BlockBox";

/**
 * Measures where a block of the rendered doc is
 *
 * @param view the element that holds the doc and its controls
 * @param block the element carrying the block's `data-md-block`
 * @returns the block's box, relative to the view
 */
export function measureBlock(view: Element, block: Element): BlockBox {
  const viewBox = view.getBoundingClientRect();
  const { height, left, top, width } = block.getBoundingClientRect();
  return {
    height,
    index: Number(block.getAttribute("data-md-block")),
    left: left - viewBox.left,
    top: top - viewBox.top,
    width,
  };
}
