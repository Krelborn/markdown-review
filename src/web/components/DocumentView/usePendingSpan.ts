import type { RefObject } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";
import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { wholeBlockSpan } from "../../anchoring/wholeBlockSpan";

import type { SpanBox } from "./SpanBox";
import { useMeasuredSpan } from "./useMeasuredSpan";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * The blocks a comment on whole blocks is being written on, and where they are
 */
export interface PendingSpan extends BlockSpan {
  box: SpanBox;
}

/**
 * Measures the blocks a comment on whole blocks is being written on, so the view can keep them framed
 *
 * @param pendingPassage the passage of the comment the user is writing on this doc, or null
 * @returns the blocks and where they are, or null when the comment is not on the whole text of one or more blocks
 */
export function usePendingSpan(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  pendingPassage: NewPassageAnchor | null
): PendingSpan | null {
  const span =
    rendered === null || pendingPassage === null
      ? null
      : wholeBlockSpan(rendered.documentText, pendingPassage.startOffset, pendingPassage.endOffset);
  const box = useMeasuredSpan(viewRef, contentRef, rendered, span);
  return span === null || box === null ? null : { ...span, box };
}
