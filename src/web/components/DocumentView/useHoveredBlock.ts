import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";

/**
 * Follows the block under the pointer, so the view can offer a comment on the whole block beside it
 *
 * @returns where the block is, or null when the pointer has left the view
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): BlockBox | null {
  const [hoveredBlock, setHoveredBlock] = useState<BlockBox | null>(null);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null) {
      return;
    }
    const enter = (event: MouseEvent): void => {
      const block = event.target instanceof Node ? blockElementAt(content, event.target) : null;
      if (block !== null) {
        setHoveredBlock(measureBlock(view, block));
      }
    };
    const leave = (): void => setHoveredBlock(null);
    content.addEventListener("mouseover", enter);
    view.addEventListener("mouseleave", leave);
    return () => {
      content.removeEventListener("mouseover", enter);
      view.removeEventListener("mouseleave", leave);
    };
  }, [contentRef, viewRef]);
  return hoveredBlock;
}
