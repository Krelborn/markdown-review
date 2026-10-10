import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { findOverlaps } from "../../anchoring/findOverlaps";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

export const threadsHighlightName = "markdown-review-threads";

export const overlapHighlightName = "markdown-review-overlap";

export const hoveredHighlightName = "markdown-review-hovered";

export const selectedHighlightName = "markdown-review-selected";

export const pendingHighlightName = "markdown-review-pending";

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

export interface ThreadHighlightOptions {
  /**
   * The thread the user is pointing at, in the doc or the comments, or null
   */
  hoveredThreadId: number | null;

  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

  selectedThreadId: number | null;

  /**
   * The threads to highlight; a new array on every render would measure the page on every render
   */
  threads: readonly Thread[];
}

interface ThreadRange {
  range: Range;
  thread: Thread;
}

interface HighlightLayer {
  name: string;
  ranges: Range[];
}

/**
 * Highlights the threads' passages in the rendered doc, deeper where two overlap, the hovered thread's above the rest,
 * the selected thread's apart, and the passage of the comment the user is writing apart again, and measures where each
 * thread's passage starts so the view can mark it
 *
 * @returns a marker for each thread's passage found in the page, top to bottom
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { hoveredThreadId, pendingPassage, selectedThreadId, threads }: ThreadHighlightOptions
): ThreadMarker[] {
  const [markers, setMarkers] = useState<ThreadMarker[]>([]);
  const layoutRevision = useLayoutRevision(contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setMarkers([]);
      return;
    }
    const ranges = threadRanges(content, rendered, threads);
    const rangesIn = (name: string): Range[] =>
      ranges
        .filter(({ thread }) => highlightOf(thread.id, selectedThreadId, hoveredThreadId) === name)
        .map(({ range }) => range);
    const unselected = ranges.filter(({ thread }) => thread.id !== selectedThreadId).map(({ range }) => range);
    const pendingRange =
      pendingPassage === null
        ? null
        : rangeForPassage(content, rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
    const names = paintHighlights([
      { name: threadsHighlightName, ranges: rangesIn(threadsHighlightName) },
      { name: overlapHighlightName, ranges: findOverlaps(unselected) },
      { name: hoveredHighlightName, ranges: rangesIn(hoveredHighlightName) },
      { name: selectedHighlightName, ranges: rangesIn(selectedHighlightName) },
      { name: pendingHighlightName, ranges: pendingRange === null ? [] : [pendingRange] },
    ]);
    setMarkers(placeMarkers(ranges, view.getBoundingClientRect().top));
    return () => {
      for (const name of names) {
        CSS.highlights.delete(name);
      }
    };
  }, [contentRef, hoveredThreadId, layoutRevision, pendingPassage, rendered, selectedThreadId, threads, viewRef]);
  return markers;
}

function threadRanges(
  content: HTMLElement,
  { documentText }: RenderedDocument,
  threads: readonly Thread[]
): ThreadRange[] {
  return threads.flatMap((thread): ThreadRange[] => {
    const { anchor } = thread;
    const range =
      anchor.kind === "passage" ? rangeForPassage(content, documentText, anchor.startOffset, anchor.endOffset) : null;
    return range === null ? [] : [{ range, thread }];
  });
}

function highlightOf(threadId: number, selectedThreadId: number | null, hoveredThreadId: number | null): string {
  if (threadId === selectedThreadId) {
    return selectedHighlightName;
  }
  return threadId === hoveredThreadId ? hoveredHighlightName : threadsHighlightName;
}

/**
 * Registers the highlights so that each paints over the ones before it
 *
 * @returns the names registered
 */
function paintHighlights(layers: readonly HighlightLayer[]): string[] {
  return layers.map(({ name, ranges }, priority) => {
    const highlight = new Highlight(...ranges);
    highlight.priority = priority;
    CSS.highlights.set(name, highlight);
    return name;
  });
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
