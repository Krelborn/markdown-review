import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { BlockSpan } from "../../../shared/markdown/BlockSpan";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import { GutterControls } from "./GutterControls";
import { SelectionCommentButton } from "./SelectionCommentButton";
import { ThreadBars } from "./ThreadBars";
import { ThreadMarkers } from "./ThreadMarkers";
import type { GutterDrag } from "./useGutterDrag";
import type { HoveredBlock } from "./useHoveredBlock";
import type { OfferedStructure } from "./useOfferedStructure";
import type { PendingSpan } from "./usePendingSpan";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadBar } from "./measureThreadBars";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  gutterDrag: GutterDrag;

  /**
   * The block the + sits beside, or null
   */
  hoveredBlock: HoveredBlock | null;

  /**
   * Whether the + has the keyboard focus
   */
  isBlockButtonFocused: boolean;

  markers: ThreadMarker[];

  /**
   * The structure the gutter offers a comment on, or null
   */
  offeredStructure: OfferedStructure | null;

  /**
   * Called when the + gains or loses the keyboard focus
   */
  onBlockButtonFocusChange: (isFocused: boolean) => void;

  onComment: (newComment: NewComment) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * The blocks a comment on whole blocks is being written on, or null
   */
  pendingSpan: PendingSpan | null;

  /**
   * The doc on the page, or null until it has rendered
   */
  rendered: RenderedDocument | null;

  selectedThreadId: number | null;
  selectionComment: SelectionComment | null;

  /**
   * A bar beside the blocks of each highlighted comment on two or more whole blocks
   */
  threadBars: ThreadBar[];
}

/**
 * The controls laid over the rendered doc: the gutter down its left, with a bracket beside the structure it offers, +
 * beside the block the pointer picks, a frame around the blocks a comment is for, a bar beside the blocks of each
 * comment on several whole blocks, a numbered marker beside each thread's passage, and Comment beside the selected text
 */
export function DocumentControls({
  document: shown,
  gutterDrag,
  hoveredBlock,
  isBlockButtonFocused,
  markers,
  offeredStructure,
  onBlockButtonFocusChange,
  onComment,
  onSelectThread,
  pendingSpan,
  rendered,
  selectedThreadId,
  selectionComment,
  threadBars,
}: DocumentControlsProps): JSX.Element {
  // A comment is sent with the hash of the rendering it was made on, which lags the source while a newer one renders
  const commentOnSpan = (span: BlockSpan): void => {
    const anchor = rendered === null ? null : blockPassage(rendered.documentText, shown.path, span);
    if (rendered !== null && anchor !== null) {
      onComment({ anchor, renderedHash: rendered.hash });
    }
  };
  const commentOnSelection = ({ anchor, renderedHash }: SelectionComment): void => {
    onComment({ anchor, renderedHash });
    document.getSelection()?.removeAllRanges();
  };
  return (
    <>
      <GutterControls
        gutterDrag={gutterDrag}
        hoveredBlock={hoveredBlock}
        isBlockButtonFocused={isBlockButtonFocused}
        offeredStructure={offeredStructure}
        onBlockButtonFocusChange={onBlockButtonFocusChange}
        onComment={commentOnSpan}
        pendingSpan={pendingSpan}
      />
      {/* While the user drags down the gutter, the drag's frame is the only one */}
      <ThreadBars
        bars={threadBars}
        isFraming={gutterDrag.span === null}
        onSelectThread={onSelectThread}
        selectedThreadId={selectedThreadId}
      />
      <ThreadMarkers markers={markers} onSelectThread={onSelectThread} selectedThreadId={selectedThreadId} />
      <SelectionCommentButton onComment={commentOnSelection} selectionComment={selectionComment} />
    </>
  );
}
