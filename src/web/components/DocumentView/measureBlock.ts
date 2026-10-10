import type { BlockBox } from "./BlockBox";

/**
 * Measures where a block of the rendered doc is
 *
 * @param view the element that holds the doc and its controls
 * @param block the element carrying the block's `data-md-block`
 * @returns the block's box, relative to the view; a table row's box spans only the part of the row its table shows
 */
export function measureBlock(view: Element, block: Element): BlockBox {
  const viewBox = view.getBoundingClientRect();
  const blockBox = block.getBoundingClientRect();
  const shownBox = block.closest("table")?.getBoundingClientRect() ?? blockBox;
  const left = Math.max(blockBox.left, shownBox.left);
  const right = Math.min(blockBox.right, shownBox.right);
  return {
    height: blockBox.height,
    index: Number(block.getAttribute("data-md-block")),
    left: left - viewBox.left,
    top: blockBox.top - viewBox.top,
    width: right - left,
  };
}
