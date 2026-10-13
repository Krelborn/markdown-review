import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { DocumentText } from "../../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { coversSeveralBlocks } from "../../anchoring/coversSeveralBlocks";
import { findOverlaps } from "../../anchoring/findOverlaps";
import { rangeForPassage } from "../../anchoring/rangeForPassage";
import { threadsOnText } from "../../review/threadsOnText";

import type { ThreadBar } from "./measureThreadBars";
import { measureThreadBars } from "./measureThreadBars";
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

  /**
   * How far the table or block that the thread's passage starts in reaches past the prose's right edge, or 0
   */
  outset: number;

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
   * The passage of the comment the user is writing on this doc, or null; it is not highlighted when it is the whole
   * text of several blocks, which the view frames instead
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
 * What the view draws for the threads beside the doc
 */
export interface ThreadHighlights {
  /**
   * A bar beside the blocks of each comment on two or more whole blocks, in place of a highlight
   */
  bars: ThreadBar[];

  /**
   * A marker for each thread's passage found in the page, top to bottom
   */
  markers: ThreadMarker[];
}

const noHighlights: ThreadHighlights = { bars: [], markers: [] };

/**
 * Highlights the threads' passages in the rendered doc, deeper where two overlap, the hovered thread's above the rest,
 * the selected thread's apart, and the passage of the comment the user is writing apart again, and measures where each
 * thread's passage starts so the view can mark it. A passage that is the whole text of two or more blocks is not
 * highlighted: the view draws a bar beside its blocks.
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { hoveredThreadId, pendingPassage, selectedThreadId, threads }: ThreadHighlightOptions
): ThreadHighlights {
  const [highlights, setHighlights] = useState<ThreadHighlights>(noHighlights);
  const layoutRevision = useLayoutRevision(viewRef, contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setHighlights(noHighlights);
      return;
    }
    const { documentText } = rendered;
    const ranges = threadRanges(content, rendered, threads);
    const onText = new Set(threadsOnText(documentText, threads).map(({ id }) => id));
    const names = paintHighlights(
      highlightLayers(
        ranges.filter(({ thread }) => onText.has(thread.id)),
        { hoveredThreadId, selectedThreadId },
        pendingRangeOf(content, documentText, pendingPassage)
      )
    );
    setHighlights({
      bars: measureThreadBars(view, content, documentText, threads),
      markers: placeMarkers(ranges, view.getBoundingClientRect().top, content.getBoundingClientRect().right),
    });
    return () => {
      for (const name of names) {
        CSS.highlights.delete(name);
      }
    };
  }, [contentRef, hoveredThreadId, layoutRevision, pendingPassage, rendered, selectedThreadId, threads, viewRef]);
  return highlights;
}

/**
 * @returns the layers of highlight to paint, each over the ones before it
 */
function highlightLayers(
  ranges: readonly ThreadRange[],
  { hoveredThreadId, selectedThreadId }: Pick<ThreadHighlightOptions, "hoveredThreadId" | "selectedThreadId">,
  pendingRange: Range | null
): HighlightLayer[] {
  const rangesIn = (name: string): Range[] =>
    ranges
      .filter(({ thread }) => highlightOf(thread.id, selectedThreadId, hoveredThreadId) === name)
      .map(({ range }) => range);
  const unselected = ranges.filter(({ thread }) => thread.id !== selectedThreadId).map(({ range }) => range);
  return [
    { name: threadsHighlightName, ranges: rangesIn(threadsHighlightName) },
    { name: overlapHighlightName, ranges: findOverlaps(unselected) },
    { name: hoveredHighlightName, ranges: rangesIn(hoveredHighlightName) },
    { name: selectedHighlightName, ranges: rangesIn(selectedHighlightName) },
    { name: pendingHighlightName, ranges: pendingRange === null ? [] : [pendingRange] },
  ];
}

/**
 * @returns the range of the passage of the comment the user is writing, or null when there is none or it is the whole
 *   text of several blocks, which the view frames instead
 */
function pendingRangeOf(
  content: HTMLElement,
  documentText: DocumentText,
  pendingPassage: NewPassageAnchor | null
): Range | null {
  return pendingPassage === null ||
    coversSeveralBlocks(documentText, pendingPassage.startOffset, pendingPassage.endOffset)
    ? null
    : rangeForPassage(content, documentText, pendingPassage.startOffset, pendingPassage.endOffset);
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

function placeMarkers(ranges: readonly ThreadRange[], viewTop: number, proseRight: number): ThreadMarker[] {
  const placed = ranges
    .map(({ range, thread }) => ({
      outset: outsetOf(range, proseRight),
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

/**
 * The table comes before the block, because a row of a table that scrolls is wider than what the table shows
 */
function outsetOf(range: Range, proseRight: number): number {
  const { startContainer } = range;
  const start = startContainer instanceof Element ? startContainer : startContainer.parentElement;
  const block = start?.closest("table") ?? start?.closest("[data-md-block]") ?? null;
  return block === null ? 0 : Math.max(0, block.getBoundingClientRect().right - proseRight);
}
