import type { RefObject } from "react";
import { useEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { selectedPassage } from "../../anchoring/selectedPassage";

import type { RenderedDocument } from "./useRenderedDocument";

export interface SelectionComment {
  anchor: NewPassageAnchor;

  /**
   * Where the selection ends, relative to the view
   */
  left: number;

  /**
   * The hash of the rendering the text was selected in, which the comment is sent with
   */
  renderedHash: string;

  /**
   * How far the room for Comment reaches beyond where the selection ends: to the view's right edge, and on into the
   * room beside it that wide blocks reach into; negative when the selection ends past it
   */
  roomToRight: number;

  top: number;
}

/**
 * Follows the user's selection in the rendered doc, and where it ends as the doc reflows
 *
 * @returns the anchor a comment on the selected text would have and where to offer it, or null when no text of the
 *   doc is selected
 */
export function useSelectionComment(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  documentPath: string
): SelectionComment | null {
  const [selectionComment, setSelectionComment] = useState<SelectionComment | null>(null);
  useEffect(() => {
    const update = (): void => {
      const selection = document.getSelection();
      const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const view = viewRef.current;
      const content = contentRef.current;
      if (range === null || view === null || content === null || rendered === null) {
        setSelectionComment(null);
        return;
      }
      const anchor = selectedPassage(content, rendered.documentText, documentPath, range);
      const end = range.getBoundingClientRect();
      const viewBox = view.getBoundingClientRect();
      setSelectionComment(
        anchor === null
          ? null
          : {
              anchor,
              left: end.right - viewBox.left,
              renderedHash: rendered.hash,
              roomToRight: viewBox.right + wideRoomOf(view) - end.right,
              top: end.bottom - viewBox.top,
            }
      );
    };
    document.addEventListener("selectionchange", update);
    // Resizing the doc reflows its text, which moves where the selection ends
    const observer = new ResizeObserver(update);
    if (contentRef.current !== null) {
      observer.observe(contentRef.current);
    }
    return () => {
      document.removeEventListener("selectionchange", update);
      observer.disconnect();
    };
  }, [contentRef, documentPath, rendered, viewRef]);
  return selectionComment;
}

/**
 * @returns the room beside the view that wide blocks reach into, which the view's CSS works out as `--wide-room`, or 0
 *   where no CSS applies
 */
function wideRoomOf(view: Element): number {
  return Number.parseFloat(getComputedStyle(view).getPropertyValue("--wide-room")) || 0;
}
