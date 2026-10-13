import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { measureBlock } from "./measureBlock";
import type { SpanBox } from "./SpanBox";

interface Edges {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/**
 * Measures where a run of the rendered doc's blocks is
 *
 * @param view the element that holds the doc and its controls
 * @param content the element the rendered doc was inserted into
 * @param span the blocks
 * @returns the box relative to the view, or null when the doc has no such blocks. One block is measured as
 *   `measureBlock` measures it. Rows of one table cover the part the table shows. Any other run reaches across the
 *   prose, or to the right edge of its widest block where that is further. Down the page, a run reaches round the
 *   outermost elements at either end whose blocks all lie in it, such as a whole alert or table.
 */
export function measureSpan(view: Element, content: Element, { firstBlock, lastBlock }: BlockSpan): SpanBox | null {
  const isInSpan = (block: Element): boolean => {
    const index = Number(block.getAttribute("data-md-block"));
    return index >= firstBlock && index <= lastBlock;
  };
  const blocks = [...content.querySelectorAll("[data-md-block]")].filter(isInSpan);
  const [first] = blocks;
  const last = blocks.at(-1);
  if (first === undefined || last === undefined || blocks.length !== lastBlock - firstBlock + 1) {
    return null;
  }
  if (blocks.length === 1) {
    return measureBlock(view, first);
  }
  const viewBox = view.getBoundingClientRect();
  const shown = blocks.map(shownEdges);
  const table = first.closest("table");
  const isOneTable = table !== null && blocks.every((block) => block.closest("table") === table);
  const contentBox = content.getBoundingClientRect();
  const across = isOneTable
    ? table.getBoundingClientRect()
    : { left: contentBox.left, right: Math.max(contentBox.right, ...shown.map(({ right }) => right)) };
  const top = Math.min(
    outermostWithin(first, content, isInSpan).getBoundingClientRect().top,
    ...shown.map((edges) => edges.top)
  );
  const bottom = Math.max(
    outermostWithin(last, content, isInSpan).getBoundingClientRect().bottom,
    ...shown.map((edges) => edges.bottom)
  );
  return {
    height: bottom - top,
    left: across.left - viewBox.left,
    top: top - viewBox.top,
    width: across.right - across.left,
  };
}

/**
 * @returns the outermost element, from the block up to the content, whose blocks all lie in the span, so that a frame
 *   round the span takes in what such an element draws round its blocks, such as an alert's title and border
 */
function outermostWithin(block: Element, content: Element, isInSpan: (block: Element) => boolean): Element {
  let outermost = block;
  for (
    let ancestor = block.parentElement;
    ancestor !== null && ancestor !== content;
    ancestor = ancestor.parentElement
  ) {
    if (![...ancestor.querySelectorAll("[data-md-block]")].every(isInSpan)) {
      break;
    }
    outermost = ancestor;
  }
  return outermost;
}

/**
 * @returns the block's edges, keeping a table row's to the part its table shows
 */
function shownEdges(block: Element): Edges {
  const { bottom, left, right, top } = block.getBoundingClientRect();
  const table = block.closest("table")?.getBoundingClientRect();
  return table === undefined
    ? { bottom, left, right, top }
    : { bottom, left: Math.max(left, table.left), right: Math.min(right, table.right), top };
}
