import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { wholeBlockIndex } from "../../anchoring/wholeBlockIndex";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Measures the block a whole-block comment is being written on, so the view can keep it framed
 *
 * @param pendingPassage the passage of the comment the user is writing on this doc, or null
 * @returns where the block is, or null when the comment is not on exactly one block's whole text
 */
export function usePendingBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  pendingPassage: NewPassageAnchor | null
): BlockBox | null {
  const [pendingBlock, setPendingBlock] = useState<BlockBox | null>(null);
  const layoutRevision = useLayoutRevision(contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const index =
      rendered === null || pendingPassage === null
        ? null
        : wholeBlockIndex(rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    const block = index === null ? null : (contentRef.current?.querySelector(`[data-md-block="${index}"]`) ?? null);
    setPendingBlock(view === null || block === null ? null : measureBlock(view, block));
  }, [contentRef, layoutRevision, pendingPassage, rendered, viewRef]);
  return pendingBlock;
}
