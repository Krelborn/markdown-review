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
   * How far the view's right edge lies beyond where the selection ends; negative when the selection ends past it
   */
  roomToRight: number;

  top: number;
}

/**
 * Follows the user's selection in the rendered doc
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
              roomToRight: viewBox.right - end.right,
              top: end.bottom - viewBox.top,
            }
      );
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [contentRef, documentPath, rendered, viewRef]);
  return selectionComment;
}
