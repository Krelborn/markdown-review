import type { DocumentText } from "../../../shared/markdown/DocumentText";
import type { Thread } from "../../../shared/review/threadSchema";
import { wholeBlockSpan } from "../../anchoring/wholeBlockSpan";

import { measureSpan } from "./measureSpan";
import type { SpanThread } from "./placeThreadBars";
import { placeThreadBars } from "./placeThreadBars";
import type { SpanBox } from "./SpanBox";

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
 * Places and measures a bar beside the blocks of each comment on two or more whole blocks
 *
 * @param view the element that holds the doc and its controls
 * @param content the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param threads the threads whose passages the doc shows
 * @returns a bar for each such thread whose blocks are in the page
 */
export function measureThreadBars(
  view: Element,
  content: Element,
  documentText: DocumentText,
  threads: readonly Thread[]
): ThreadBar[] {
  const spanThreads = threads.flatMap((thread) => spanThreadOf(documentText, thread) ?? []);
  return placeThreadBars(spanThreads).flatMap(({ lane, threadId, ...span }) => {
    const box = measureSpan(view, content, span);
    return box === null ? [] : [{ box, lane, threadId }];
  });
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
