import type { RefObject } from "react";
import { useContext } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import { useBlockIndexLevelWith } from "./useBlockIndexLevelWith";
import type { GutterDrag } from "./useGutterDrag";
import { useGutterDrag } from "./useGutterDrag";
import type { HoveredBlock } from "./useHoveredBlock";
import { useHoveredBlock } from "./useHoveredBlock";
import { useHoveredThread } from "./useHoveredThread";
import type { OfferedStructure } from "./useOfferedStructure";
import { useOfferedStructure } from "./useOfferedStructure";
import type { PendingSpan } from "./usePendingSpan";
import { usePendingSpan } from "./usePendingSpan";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import { useSelectionComment } from "./useSelectionComment";
import type { ThreadBar } from "./measureThreadBars";
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
  gutterDrag: GutterDrag;

  /**
   * The block the + sits beside: the block the pointer picks, or the + kept on its block while it has the focus; or
   * null
   */
  hoveredBlock: HoveredBlock | null;

  /**
   * Whether the pointer is over a highlighted passage, which a click selects
   */
  isPointingAtHighlight: boolean;

  markers: ThreadMarker[];

  /**
   * The structure the gutter offers a comment on, around the block it picks, or null when the pointer is not in the
   * gutter or the user is dragging
   */
  offeredStructure: OfferedStructure | null;

  /**
   * The blocks a comment on whole blocks is being written on, or null
   */
  pendingSpan: PendingSpan | null;

  selectionComment: SelectionComment | null;

  /**
   * A bar beside the blocks of each highlighted comment on two or more whole blocks
   */
  threadBars: ThreadBar[];
}

/**
 * Follows what is drawn over the rendered doc: the threads' highlights, markers and bars, the thread and block under the
 * pointer, a drag down the gutter, the blocks a comment is being written on, and the Comment button beside selected text
 */
export function useDocumentOverlay(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, highlightedThreads, isBlockButtonFocused, pendingPassage, selectedThreadId }: DocumentOverlayOptions
): DocumentOverlay {
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  const { bars: threadBars, markers } = useThreadHighlights(viewRef, contentRef, rendered, {
    hoveredThreadId,
    pendingPassage,
    selectedThreadId,
    threads: highlightedThreads,
  });
  const isPointingAtHighlight = useHoveredThread(viewRef, contentRef, rendered, highlightedThreads, onHoverThread);
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, documentPath);
  const blockIndexLevelWith = useBlockIndexLevelWith(viewRef, contentRef, rendered);
  const gutterDrag = useGutterDrag(viewRef, contentRef, rendered, blockIndexLevelWith);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef, rendered, {
    blockIndexLevelWith,
    isHeld: isBlockButtonFocused,
    isPinned: gutterDrag.span !== null,
  });
  const isPickingInGutter = hoveredBlock?.isPointerInGutter === true && gutterDrag.span === null;
  const offeredStructure = useOfferedStructure(
    viewRef,
    contentRef,
    rendered,
    isPickingInGutter ? hoveredBlock.box.index : null
  );
  const pendingSpan = usePendingSpan(viewRef, contentRef, rendered, pendingPassage);
  return {
    gutterDrag,
    hoveredBlock,
    isPointingAtHighlight,
    markers,
    offeredStructure,
    pendingSpan,
    selectionComment,
    threadBars,
  };
}
