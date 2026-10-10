import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Follows the block under the pointer, so the view can offer a comment on the whole block beside it
 *
 * @returns where the block is, or null when the pointer has left the view or the doc has rendered again since the
 *   pointer moved onto the block, as the block may have moved or be another block now
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null
): BlockBox | null {
  const [hovered, setHovered] = useState<{ block: BlockBox; rendered: RenderedDocument } | null>(null);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      return;
    }
    const enter = (event: MouseEvent): void => {
      const block = event.target instanceof Node ? blockElementAt(content, event.target) : null;
      if (block !== null) {
        setHovered({ block: measureBlock(view, block), rendered });
      }
    };
    const leave = (): void => setHovered(null);
    content.addEventListener("mouseover", enter);
    view.addEventListener("mouseleave", leave);
    return () => {
      content.removeEventListener("mouseover", enter);
      view.removeEventListener("mouseleave", leave);
    };
  }, [contentRef, rendered, viewRef]);
  return hovered !== null && hovered.rendered === rendered ? hovered.block : null;
}
