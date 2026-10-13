import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

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
   */
  startDrag: (event: ReactPointerEvent<Element>, onEnd: (span: BlockSpan) => void) => void;
}

interface Drag {
  endBlock: number;
  onEnd: (span: BlockSpan) => void;
  startBlock: number;
}

/**
 * Follows a drag down the gutter, which picks every block from the one level with the press to the one level with the
 * pointer
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
    const move = (event: PointerEvent): void => {
      const block = blockIndexLevelWith(event.clientY);
      if (block !== null && block !== endBlockRef.current) {
        endBlockRef.current = block;
        setDrag((current) => (current === null ? null : { ...current, endBlock: block }));
      }
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
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", cancelOnEscape, { capture: true });
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", cancelOnEscape, { capture: true });
    };
  }, [blockIndexLevelWith, onEnd, startBlock]);
  // The blocks may have moved or be other blocks in a new rendering
  useEffect(() => () => setDrag(null), [rendered]);
  const startDrag = useCallback(
    (event: ReactPointerEvent<Element>, onDragEnd: (span: BlockSpan) => void): void => {
      const block = event.button === 0 ? blockIndexLevelWith(event.clientY) : null;
      if (block === null) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      endBlockRef.current = block;
      setDrag({ endBlock: block, onEnd: onDragEnd, startBlock: block });
    },
    [blockIndexLevelWith]
  );
  return { box, span, startDrag };
}

function spanBetween(startBlock: number, endBlock: number): BlockSpan {
  return { firstBlock: Math.min(startBlock, endBlock), lastBlock: Math.max(startBlock, endBlock) };
}
