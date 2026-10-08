import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Scrolls the selected thread's passage into view once, when the user selects the thread or its doc first renders,
 * unless the passage is already on screen
 *
 * @param threads the doc's threads with a passage in the page
 */
export function useRevealSelectedThread(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null
): void {
  const revealedThreadId = useRef<number | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (selectedThreadId === revealedThreadId.current || content === null || rendered === null) {
      return;
    }
    revealedThreadId.current = selectedThreadId;
    const range = passageRange(
      content,
      rendered,
      threads.find((thread) => thread.id === selectedThreadId)
    );
    if (range !== null && !isOnScreen(range.getBoundingClientRect())) {
      const start = range.startContainer;
      (start instanceof Element ? start : start.parentElement)?.scrollIntoView({ block: "center" });
    }
  }, [contentRef, rendered, selectedThreadId, threads]);
}

function passageRange(content: HTMLElement, rendered: RenderedDocument, thread: Thread | undefined): Range | null {
  const anchor = thread?.anchor;
  return anchor?.kind === "passage"
    ? rangeForPassage(content, rendered.documentText, anchor.startOffset, anchor.endOffset)
    : null;
}

function isOnScreen(box: DOMRect): boolean {
  return box.top >= 0 && box.bottom <= innerHeight;
}
