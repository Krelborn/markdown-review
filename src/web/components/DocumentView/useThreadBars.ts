import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { DocumentText } from "../../../shared/markdown/DocumentText";
import type { Thread } from "../../../shared/review/threadSchema";
import { wholeBlockSpan } from "../../anchoring/wholeBlockSpan";

import { measureSpan } from "./measureSpan";
import type { SpanThread } from "./placeThreadBars";
import { placeThreadBars } from "./placeThreadBars";
import type { SpanBox } from "./SpanBox";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * The bar beside the blocks of a comment on two or more whole blocks
 */
export interface ThreadBar {
  /**
   * Where the comment's blocks are
   */
  box: SpanBox;

  /**
   * The lane the bar runs in: 1 nearest the prose, 2 outside it
   */
  lane: 1 | 2;

  threadId: number;
}

/**
 * Places and measures a bar beside the blocks of each comment on two or more whole blocks, again whenever the layout
 * changes
 *
 * @param threads the threads whose passages are highlighted; a new array on every render would measure the page on
 *   every render
 * @returns a bar for each such thread whose blocks are in the page
 */
export function useThreadBars(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[]
): ThreadBar[] {
  const [bars, setBars] = useState<ThreadBar[]>([]);
  const layoutRevision = useLayoutRevision(viewRef, contentRef);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setBars([]);
      return;
    }
    const spanThreads = threads.flatMap((thread) => spanThreadOf(rendered.documentText, thread) ?? []);
    setBars(
      placeThreadBars(spanThreads).flatMap(({ lane, threadId, ...span }) => {
        const box = measureSpan(view, content, span);
        return box === null ? [] : [{ box, lane, threadId }];
      })
    );
  }, [contentRef, layoutRevision, rendered, threads, viewRef]);
  return bars;
}

/**
 * @returns the thread's blocks, when its passage is the whole text of two or more blocks, or null
 */
function spanThreadOf(documentText: DocumentText, { anchor, id }: Thread): SpanThread | null {
  if (anchor.kind !== "passage") {
    return null;
  }
  const span = wholeBlockSpan(documentText, anchor.startOffset, anchor.endOffset);
  return span === null || span.lastBlock === span.firstBlock
    ? null
    : { ...span, length: anchor.endOffset - anchor.startOffset, threadId: id };
}
