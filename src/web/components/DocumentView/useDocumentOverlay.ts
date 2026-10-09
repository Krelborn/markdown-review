import type { RefObject } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";

import type { BlockBox } from "./BlockBox";
import { useHoveredBlock } from "./useHoveredBlock";
import { usePendingBlock } from "./usePendingBlock";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import { useSelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";
import { useThreadHighlights } from "./useThreadHighlights";

export interface DocumentOverlayOptions {
  /**
   * The doc's repo-relative path
   */
  documentPath: string;

  /**
   * The threads whose passages are highlighted; a new array on every render would measure the page on every render
   */
  highlightedThreads: readonly Thread[];

  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

  selectedThreadId: number | null;
}

export interface DocumentOverlay {
  /**
   * The block under the pointer, or null
   */
  hoveredBlock: BlockBox | null;

  markers: ThreadMarker[];

  /**
   * The block a whole-block comment is being written on, or null
   */
  pendingBlock: BlockBox | null;

  selectionComment: SelectionComment | null;
}

/**
 * Follows what is drawn over the rendered doc: the threads' highlights and markers, the block under the pointer, the
 * block a comment is being written on, and the Comment button beside selected text
 */
export function useDocumentOverlay(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, highlightedThreads, pendingPassage, selectedThreadId }: DocumentOverlayOptions
): DocumentOverlay {
  const markers = useThreadHighlights(viewRef, contentRef, rendered, {
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, documentPath);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef);
  const pendingBlock = usePendingBlock(viewRef, contentRef, rendered, pendingPassage);
  return { hoveredBlock, markers, pendingBlock, selectionComment };
}
