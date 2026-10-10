import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Follows the block the + sits beside, so the view can offer a comment on the whole block: the block under the
 * pointer, or while the + has the focus the last one the pointer was over; it is measured again whenever the content's
 * layout changes
 *
 * @param isHeld whether the + has the focus, which keeps it on its block after the pointer leaves the view
 * @returns where the block is, or null when the pointer has left the view and the + is not held, or when the doc has
 *   rendered again since the pointer moved onto the block, as the block may have moved or be another block now
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  isHeld: boolean
): BlockBox | null {
  const [pointed, setPointed] = useState<{ index: number; rendered: RenderedDocument } | null>(null);
  const [isPointerInView, setIsPointerInView] = useState(false);
  const [box, setBox] = useState<BlockBox | null>(null);
  const layoutRevision = useLayoutRevision(contentRef);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      return;
    }
    const enter = (event: MouseEvent): void => {
      const block = event.target instanceof Node ? blockElementAt(content, event.target) : null;
      if (block !== null) {
        const index = Number(block.getAttribute("data-md-block"));
        setIsPointerInView(true);
        setPointed((current) =>
          current?.index === index && current.rendered === rendered ? current : { index, rendered }
        );
      }
    };
    const leave = (): void => setIsPointerInView(false);
    content.addEventListener("mouseover", enter);
    view.addEventListener("mouseleave", leave);
    return () => {
      content.removeEventListener("mouseover", enter);
      view.removeEventListener("mouseleave", leave);
    };
  }, [contentRef, rendered, viewRef]);
  const blockIndex =
    pointed !== null && pointed.rendered === rendered && (isPointerInView || isHeld) ? pointed.index : null;
  useLayoutEffect(() => {
    const view = viewRef.current;
    const block =
      blockIndex === null ? null : (contentRef.current?.querySelector(`[data-md-block="${blockIndex}"]`) ?? null);
    setBox(view === null || block === null ? null : measureBlock(view, block));
  }, [blockIndex, contentRef, layoutRevision, viewRef]);
  return blockIndex === null ? null : box;
}
