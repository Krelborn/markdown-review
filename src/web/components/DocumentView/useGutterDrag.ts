import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { autoScrollStep } from "./autoScrollStep";
import { scrollingAncestor } from "./scrollingAncestor";
import type { SpanBox } from "./SpanBox";
import { useMeasuredSpan } from "./useMeasuredSpan";
import type { RenderedDocument } from "./useRenderedDocument";

export interface GutterDrag {
  /**
   * Where the blocks the drag covers are, or null when the user is not dragging or they cannot be measured
   */
  box: SpanBox | null;

  /**
   * The blocks the drag covers, in the order they come down the doc, or null when the user is not dragging
   */
  span: BlockSpan | null;

  /**
   * Starts a drag from a press of the main button, from the block level with the press
   *
   * @param onEnd called with the blocks the drag covers when the user releases the button; not called when the user
   *   presses Escape or the doc renders again first
   * @returns whether a drag started, which it does not for another button, with ⌥ held, or where no block takes up any
   *   height
   */
  startDrag: (event: ReactPointerEvent<Element>, onEnd: (span: BlockSpan) => void) => boolean;
}

interface Drag {
  endBlock: number;
  onEnd: (span: BlockSpan) => void;
  startBlock: number;
}

/**
 * Follows a drag down the gutter, which picks every block from the one level with the press to the one level with the
 * pointer, and scrolls the doc while the pointer is near the top or bottom of the box the doc scrolls in
 *
 * @param blockIndexLevelWith finds the block level with a distance down the page, as the gutter picks it
 */
export function useGutterDrag(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  blockIndexLevelWith: (clientY: number) => number | null
): GutterDrag {
  const [drag, setDrag] = useState<Drag | null>(null);
  // Outlives each run of the effect below, which runs again when the layout changes during a drag
  const endBlockRef = useRef(0);
  const span = drag === null ? null : spanBetween(drag.startBlock, drag.endBlock);
  const box = useMeasuredSpan(viewRef, contentRef, rendered, span);
  const startBlock = drag?.startBlock ?? null;
  const onEnd = drag?.onEnd ?? null;
  useEffect(() => {
    if (startBlock === null || onEnd === null) {
      return;
    }
    let pointerY: number | null = null;
    const pickAt = (clientY: number): void => {
      const block = blockIndexLevelWith(clientY);
      if (block !== null && block !== endBlockRef.current) {
        endBlockRef.current = block;
        setDrag((current) => (current === null ? null : { ...current, endBlock: block }));
      }
    };
    const move = (event: PointerEvent): void => {
      pointerY = event.clientY;
      pickAt(event.clientY);
    };
    const release = (event: PointerEvent): void => {
      move(event);
      setDrag(null);
      onEnd(spanBetween(startBlock, endBlockRef.current));
    };
    const cancel = (): void => setDrag(null);
    // Caught before it reaches the comment editor, which Escape would close
    const cancelOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    const view = viewRef.current;
    const scroller = view === null ? null : scrollingAncestor(view);
    // Scrolls on each frame, so the doc keeps scrolling while the pointer rests near an edge
    const scrollNearEdge = (): void => {
      frame = requestAnimationFrame(scrollNearEdge);
      const step =
        pointerY === null
          ? 0
          : autoScrollStep(pointerY, scroller?.getBoundingClientRect() ?? { bottom: innerHeight, top: 0 });
      if (pointerY !== null && step !== 0) {
        (scroller ?? document.scrollingElement)?.scrollBy(0, step);
        pickAt(pointerY);
      }
    };
    let frame = requestAnimationFrame(scrollNearEdge);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", cancelOnEscape, { capture: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", cancelOnEscape, { capture: true });
    };
  }, [blockIndexLevelWith, onEnd, startBlock, viewRef]);
  // The blocks may have moved or be other blocks in a new rendering
  useEffect(() => () => setDrag(null), [rendered]);
  const startDrag = useCallback(
    (event: ReactPointerEvent<Element>, onDragEnd: (span: BlockSpan) => void): boolean => {
      const block = event.button === 0 && !event.altKey ? blockIndexLevelWith(event.clientY) : null;
      if (block === null) {
        return false;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      endBlockRef.current = block;
      setDrag({ endBlock: block, onEnd: onDragEnd, startBlock: block });
      return true;
    },
    [blockIndexLevelWith]
  );
  return { box, span, startDrag };
}

function spanBetween(startBlock: number, endBlock: number): BlockSpan {
  return { firstBlock: Math.min(startBlock, endBlock), lastBlock: Math.max(startBlock, endBlock) };
}
