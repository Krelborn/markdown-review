import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { offsetAtPoint } from "../../anchoring/offsetAtPoint";
import { threadAtOffset } from "../../review/threadAtOffset";
import { useThreadReporter } from "../../review/useThreadReporter";

import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

interface Point {
  clientX: number;
  clientY: number;
}

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
  const { report } = useThreadReporter(onPointedThread);
  // Where the pointer last moved over the content, or null once it has left
  const lastPointRef = useRef<Point | null>(null);
  const layoutRevision = useLayoutRevision(contentRef);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null) {
      return;
    }
    const hasHighlights = highlightedThreads.length > 0;
    const threadAt = ({ clientX, clientY }: Point): number | null => {
      // With no highlights there is nothing to look up
      if (!hasHighlights) {
        return null;
      }
      const offset = offsetAtPoint(content, rendered.documentText, clientX, clientY);
      return offset === null ? null : (threadAtOffset(highlightedThreads, offset)?.id ?? null);
    };
    // The doc, its highlights or its layout changed under a pointer that may not move again, so what it is over is
    // looked up now
    const lastPoint = lastPointRef.current;
    report(lastPoint === null ? null : threadAt(lastPoint));
    let frame = 0;
    const move = ({ clientX, clientY }: PointerEvent): void => {
      const point = { clientX, clientY };
      lastPointRef.current = point;
      if (hasHighlights) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => report(threadAt(point)));
      }
    };
    const leave = (): void => {
      lastPointRef.current = null;
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
  }, [contentRef, highlightedThreads, layoutRevision, rendered, report]);
  return pointedThreadId !== null;
}
