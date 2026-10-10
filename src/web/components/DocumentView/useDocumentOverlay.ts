import type { RefObject } from "react";
import { useContext } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import type { BlockBox } from "./BlockBox";
import { useHoveredBlock } from "./useHoveredBlock";
import { useHoveredThread } from "./useHoveredThread";
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
   * Whether the + has the keyboard focus, which keeps it on its block after the pointer leaves the view
   */
  isBlockButtonFocused: boolean;

  /**
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

  selectedThreadId: number | null;
}

export interface DocumentOverlay {
  /**
   * The block the + sits beside: the block under the pointer, or the + kept on its block while it has the focus; or
   * null
   */
  hoveredBlock: BlockBox | null;

  /**
   * Whether the pointer is over a highlighted passage, which a click selects
   */
  isPointingAtHighlight: boolean;

  markers: ThreadMarker[];

  /**
   * The block a whole-block comment is being written on, or null
   */
  pendingBlock: BlockBox | null;

  selectionComment: SelectionComment | null;
}

/**
 * Follows what is drawn over the rendered doc: the threads' highlights and markers, the thread and block under the
 * pointer, the block a comment is being written on, and the Comment button beside selected text
 */
export function useDocumentOverlay(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, highlightedThreads, isBlockButtonFocused, pendingPassage, selectedThreadId }: DocumentOverlayOptions
): DocumentOverlay {
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  const markers = useThreadHighlights(viewRef, contentRef, rendered, {
    hoveredThreadId,
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
  const isPointingAtHighlight = useHoveredThread(contentRef, rendered, highlightedThreads, onHoverThread);
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, documentPath);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef, rendered, isBlockButtonFocused);
  const pendingBlock = usePendingBlock(viewRef, contentRef, rendered, pendingPassage);
  return { hoveredBlock, isPointingAtHighlight, markers, pendingBlock, selectionComment };
}
