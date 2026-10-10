import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { offsetAtPoint } from "../../anchoring/offsetAtPoint";
import { threadAtOffset } from "../../review/threadAtOffset";
import { useThreadReporter } from "../../review/useThreadReporter";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Reports the highlighted thread under the pointer as the pointer moves over the rendered doc
 *
 * @param highlightedThreads the threads whose passages are highlighted
 * @param onHoverThread called with the thread under the pointer whenever it changes, and with null when the pointer
 *   leaves every highlight
 * @returns whether the pointer is over a highlight
 */
export function useHoveredThread(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  highlightedThreads: readonly Thread[],
  onHoverThread: (threadId: number | null) => void
): boolean {
  const [pointedThreadId, setPointedThreadId] = useState<number | null>(null);
  const onPointedThread = useCallback(
    (threadId: number | null): void => {
      setPointedThreadId(threadId);
      onHoverThread(threadId);
    },
    [onHoverThread]
  );
  // Outlives each run of the effect, so a move off a highlight is still reported after the highlighted threads change
  const { report, reported } = useThreadReporter(onPointedThread);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null) {
      return;
    }
    let frame = 0;
    if (!highlightedThreads.some(({ id }) => id === reported())) {
      // A hover on a thread that is no longer highlighted must end, without waiting for the pointer to move
      report(null);
    }
    if (highlightedThreads.length === 0) {
      // With no highlights there is nothing to look up on each move
      return;
    }
    const move = ({ clientX, clientY }: PointerEvent): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = offsetAtPoint(content, rendered.documentText, clientX, clientY);
        report(offset === null ? null : (threadAtOffset(highlightedThreads, offset)?.id ?? null));
      });
    };
    const leave = (): void => {
      cancelAnimationFrame(frame);
      report(null);
    };
    content.addEventListener("pointermove", move);
    content.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      content.removeEventListener("pointermove", move);
      content.removeEventListener("pointerleave", leave);
    };
  }, [contentRef, highlightedThreads, rendered, report, reported]);
  return pointedThreadId !== null;
}
