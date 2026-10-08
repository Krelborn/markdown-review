import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import type { RenderedDocument } from "./useRenderedDocument";

export const threadsHighlightName = "markdown-review-threads";

export const selectedHighlightName = "markdown-review-selected";

export interface ThreadMarker {
  /**
   * How many markers sit before this one on the same line
   */
  column: number;

  threadId: number;

  /**
   * Where the thread's passage starts, relative to the view
   */
  top: number;
}

interface ThreadRange {
  range: Range;
  thread: Thread;
}

/**
 * Highlights the threads' passages in the rendered doc, the selected thread's apart from the rest, and measures
 * where each passage starts so the view can mark it
 *
 * @param threads the threads to highlight; a new array on every render would measure the page on every render
 * @returns a marker for each passage found in the page, top to bottom
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null
): ThreadMarker[] {
  const [markers, setMarkers] = useState<ThreadMarker[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null) {
      return;
    }
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef]);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setMarkers([]);
      return;
    }
    const ranges = threads.flatMap((thread): ThreadRange[] => {
      const { anchor } = thread;
      const range =
        anchor.kind === "passage"
          ? rangeForPassage(content, rendered.documentText, anchor.startOffset, anchor.endOffset)
          : null;
      return range === null ? [] : [{ range, thread }];
    });
    const isSelected = ({ thread }: ThreadRange): boolean => thread.id === selectedThreadId;
    CSS.highlights.set(
      threadsHighlightName,
      new Highlight(...ranges.filter((range) => !isSelected(range)).map(({ range }) => range))
    );
    CSS.highlights.set(selectedHighlightName, new Highlight(...ranges.filter(isSelected).map(({ range }) => range)));
    setMarkers(placeMarkers(ranges, view.getBoundingClientRect().top));
    return () => {
      CSS.highlights.delete(threadsHighlightName);
      CSS.highlights.delete(selectedHighlightName);
    };
  }, [contentRef, layoutRevision, rendered, selectedThreadId, threads, viewRef]);
  return markers;
}

function placeMarkers(ranges: readonly ThreadRange[], viewTop: number): ThreadMarker[] {
  const placed = ranges
    .map(({ range, thread }) => ({
      threadId: thread.id,
      top: (range.getClientRects()[0] ?? range.getBoundingClientRect()).top - viewTop,
    }))
    .sort((left, right) => left.top - right.top || left.threadId - right.threadId);
  let column = 0;
  return placed.map((marker, index) => {
    const previous = placed[index - 1];
    column = previous !== undefined && Math.abs(marker.top - previous.top) < 4 ? column + 1 : 0;
    return { ...marker, column };
  });
}
