import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

import type { BlockBox } from "./BlockBox";
import { measureBlock } from "./measureBlock";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * The block the + sits beside
 */
export interface HoveredBlock {
  box: BlockBox;

  /**
   * Whether the pointer is in the gutter's outer lane, where it picks the structure around the block
   */
  isPointerInBracketLane: boolean;

  /**
   * Whether the pointer is in the gutter left of the doc, where it picks the block level with it
   */
  isPointerInGutter: boolean;
}

/**
 * A block the pointer picked, in the rendering it picked it in
 */
interface PickedBlock {
  index: number;
  rendered: RenderedDocument;
}

export interface HoveredBlockOptions {
  /**
   * Finds the block level with a distance down the page, as the gutter picks it
   *
   * @returns the block's index, or null when no block takes up any height
   */
  blockIndexLevelWith: (clientY: number) => number | null;

  /**
   * Whether the + has the focus, which keeps it on its block after the pointer leaves the view
   */
  isHeld: boolean;

  /**
   * Whether the + stays on its block while the pointer moves, as during a drag down the gutter
   */
  isPinned: boolean;
}

/**
 * Follows the block the + sits beside, so the view can offer a comment on the whole block: the block the pointer
 * picks, or while the + has the focus the last one it picked; it is measured again whenever the content's layout
 * changes. The pointer picks the block it is over, and beside the doc, in the gutter or on the markers' side, or over
 * the doc between blocks, the block level with it.
 *
 * @returns the block the + sits beside, or null when the pointer has left the view and the + is not held, or when the
 *   doc has rendered again since the pointer picked the block, as the block may have moved or be another block now
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { blockIndexLevelWith, isHeld, isPinned }: HoveredBlockOptions
): HoveredBlock | null {
  const [pointed, setPointed] = useState<PickedBlock | null>(null);
  // Kept while the + is pinned, so the + moves to the block under the pointer when the drag that pinned it ends
  const lastPickedRef = useRef<PickedBlock | null>(null);
  const [isPointerInView, setIsPointerInView] = useState(false);
  const [isPointerInGutter, setIsPointerInGutter] = useState(false);
  const [isPointerInBracketLane, setIsPointerInBracketLane] = useState(false);
  const [box, setBox] = useState<BlockBox | null>(null);
  const layoutRevision = useLayoutRevision(viewRef, contentRef);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      return;
    }
    const pick = (picked: PickedBlock): void =>
      setPointed((current) =>
        current?.index === picked.index && current.rendered === picked.rendered ? current : picked
      );
    const lastPicked = lastPickedRef.current;
    if (!isPinned && lastPicked?.rendered === rendered) {
      pick(lastPicked);
    }
    const point = (event: MouseEvent): void => {
      const contentBox = content.getBoundingClientRect();
      const isOnBar = event.target instanceof Element && event.target.closest("[data-thread-bar]") !== null;
      const isInGutter = event.clientX < contentBox.left && !isOnBar;
      const isBesideContent = isInGutter || event.clientX > contentBox.right;
      const index = isOnBar ? null : pickedBlockIndex(event, content, isBesideContent, blockIndexLevelWith);
      setIsPointerInGutter(isInGutter);
      setIsPointerInBracketLane(
        event.target instanceof Element && event.target.closest("[data-bracket-lane]") !== null
      );
      if (index === null) {
        return;
      }
      setIsPointerInView(true);
      lastPickedRef.current = { index, rendered };
      if (!isPinned) {
        pick({ index, rendered });
      }
    };
    const leave = (): void => {
      setIsPointerInView(false);
      setIsPointerInGutter(false);
      setIsPointerInBracketLane(false);
    };
    view.addEventListener("mouseover", point);
    view.addEventListener("mousemove", point);
    view.addEventListener("mouseleave", leave);
    return () => {
      view.removeEventListener("mouseover", point);
      view.removeEventListener("mousemove", point);
      view.removeEventListener("mouseleave", leave);
    };
  }, [blockIndexLevelWith, contentRef, isPinned, rendered, viewRef]);
  const blockIndex =
    pointed !== null && pointed.rendered === rendered && (isPointerInView || isHeld) ? pointed.index : null;
  useLayoutEffect(() => {
    const view = viewRef.current;
    const block =
      blockIndex === null ? null : (contentRef.current?.querySelector(`[data-md-block="${blockIndex}"]`) ?? null);
    setBox(view === null || block === null ? null : measureBlock(view, block));
  }, [blockIndex, contentRef, layoutRevision, viewRef]);
  return blockIndex === null || box === null ? null : { box, isPointerInBracketLane, isPointerInGutter };
}

/**
 * @returns the index of the block the pointer picks, or null when it is over a control laid over the doc, such as
 *   Comment beside a selection
 */
function pickedBlockIndex(
  event: MouseEvent,
  content: Element,
  isBesideContent: boolean,
  blockIndexLevelWith: (clientY: number) => number | null
): number | null {
  const target = event.target instanceof Node && content.contains(event.target) ? event.target : null;
  if (!isBesideContent && target === null) {
    return null;
  }
  const block = isBesideContent || target === null ? null : blockElementAt(content, target);
  return block === null ? blockIndexLevelWith(event.clientY) : Number(block.getAttribute("data-md-block"));
}
