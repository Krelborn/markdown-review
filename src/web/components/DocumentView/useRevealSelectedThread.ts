import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Scrolls the selected thread's passage into view once for each request to see it, and when its doc first renders,
 * unless the passage is already in sight in the box the doc scrolls in
 *
 * @param threads the doc's threads with a passage in the page
 * @param revealCount the count of requests to see the selected thread, which changes with each new one
 */
export function useRevealSelectedThread(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null,
  revealCount: number
): void {
  const revealedCount = useRef<number | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (revealCount === revealedCount.current || content === null || rendered === null) {
      return;
    }
    revealedCount.current = revealCount;
    const range = passageRange(
      content,
      rendered,
      threads.find((thread) => thread.id === selectedThreadId)
    );
    if (range !== null && !isOnScreen(range)) {
      const start = range.startContainer;
      (start instanceof Element ? start : start.parentElement)?.scrollIntoView({ block: "center" });
    }
  }, [contentRef, rendered, revealCount, selectedThreadId, threads]);
}

function passageRange(content: HTMLElement, rendered: RenderedDocument, thread: Thread | undefined): Range | null {
  const anchor = thread?.anchor;
  return anchor?.kind === "passage"
    ? rangeForPassage(content, rendered.documentText, anchor.startOffset, anchor.endOffset)
    : null;
}

function isOnScreen(range: Range): boolean {
  const box = range.getBoundingClientRect();
  const visible = visibleBox(range.commonAncestorContainer);
  return box.top >= visible.top && box.bottom <= visible.bottom;
}

/**
 * The box through which a node can be seen: that of its nearest ancestor that scrolls, or else the viewport
 */
function visibleBox(node: Node): Pick<DOMRect, "bottom" | "top"> {
  for (let ancestor = node.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const { overflowY } = getComputedStyle(ancestor);
    if (overflowY === "auto" || overflowY === "scroll") {
      return ancestor.getBoundingClientRect();
    }
  }
  return { bottom: innerHeight, top: 0 };
}
