import type { BlockBox } from "./BlockBox";

/**
 * Finds the block level with a distance down the view, so that every point down the doc's height picks a block: a
 * point in the gap between two blocks picks the nearer one, and a point above the first block or below the last picks
 * that block
 *
 * @param boxes the doc's blocks, in the order they come down the page
 * @param top the distance down the view
 * @returns the block, or null when no block takes up any height
 */
export function blockLevelWith(boxes: readonly BlockBox[], top: number): BlockBox | null {
  const shown = boxes.filter((box) => box.height > 0);
  return (
    shown.find((box, index) => {
      const next = shown[index + 1];
      return next === undefined || top < (box.top + box.height + next.top) / 2;
    }) ?? null
  );
}
