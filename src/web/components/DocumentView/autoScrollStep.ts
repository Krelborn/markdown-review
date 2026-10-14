/**
 * How far into the box the doc scrolls in a drag scrolls it from the box's top or bottom edge: 3rem at the browser's
 * default font size
 */
const edgeZone = 48;

/**
 * The most a drag scrolls the doc in one frame
 */
const maximumStep = 20;

/**
 * Finds how far to scroll the doc in a frame while the user drags near the top or bottom of the box it scrolls in
 *
 * @param pointerY how far down the page the pointer is
 * @param visible how far down the page the top and bottom of the box the doc scrolls in are
 * @returns how far to scroll down, negative to scroll up: further the deeper the pointer is into either edge's zone, the
 *   most past the edge, and 0 between the zones
 */
export function autoScrollStep(pointerY: number, { bottom, top }: Pick<DOMRect, "bottom" | "top">): number {
  const intoTop = top + edgeZone - pointerY;
  if (intoTop > 0) {
    return -stepFor(intoTop);
  }
  const intoBottom = pointerY - (bottom - edgeZone);
  return intoBottom > 0 ? stepFor(intoBottom) : 0;
}

function stepFor(depth: number): number {
  return Math.ceil(maximumStep * Math.min(depth / edgeZone, 1));
}
