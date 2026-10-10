import type { BlockBox } from "./BlockBox";

/**
 * The height of a line of the doc's body text: 16px at the line height of 1.6 that DocumentView.module.css gives it
 */
const lineHeight = 25.6;

/**
 * Measures where a block of the rendered doc is
 *
 * @param view the element that holds the doc and its controls
 * @param block the element carrying the block's `data-md-block`
 * @returns the block's box, relative to the view; a table row's box spans only the part of the row its table shows.
 *   The block's first line is its first line of text when that starts within a line of the block's top, as a code
 *   block's text does not, and otherwise a line at the block's top.
 */
export function measureBlock(view: Element, block: Element): BlockBox {
  const viewBox = view.getBoundingClientRect();
  const blockBox = block.getBoundingClientRect();
  const shownBox = block.closest("table")?.getBoundingClientRect() ?? blockBox;
  const left = Math.max(blockBox.left, shownBox.left);
  const right = Math.min(blockBox.right, shownBox.right);
  return {
    firstLineMiddle: firstLineMiddle(block, blockBox) - viewBox.top,
    height: blockBox.height,
    index: Number(block.getAttribute("data-md-block")),
    left: left - viewBox.left,
    top: blockBox.top - viewBox.top,
    width: right - left,
  };
}

function firstLineMiddle(block: Element, blockBox: DOMRect): number {
  const line = firstLineOfText(block);
  return line !== null && line.top - blockBox.top < lineHeight
    ? (line.top + line.bottom) / 2
    : blockBox.top + Math.min(blockBox.height, lineHeight) / 2;
}

/**
 * @returns the box of the first character the block shows, or null when it shows no text
 */
function firstLineOfText(block: Element): DOMRect | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const start = node.textContent?.search(/\S/) ?? -1;
    if (start >= 0) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + 1);
      const box = range.getBoundingClientRect();
      if (box.height > 0) {
        return box;
      }
    }
  }
  return null;
}
