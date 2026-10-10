import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import type { BlockBox } from "./BlockBox";
import { BlockCommentButton } from "./BlockCommentButton";
import { BlockGutter } from "./BlockGutter";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import { ThreadMarkers } from "./ThreadMarkers";
import type { HoveredBlock } from "./useHoveredBlock";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * Finds the block level with a distance down the page, as the gutter picks it
   *
   * @returns the block's index, or null when no block takes up any height
   */
  blockIndexLevelWith: (clientY: number) => number | null;

  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

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
   * Called when the + gains or loses the keyboard focus
   */
  onBlockButtonFocusChange: (isFocused: boolean) => void;

  onComment: (newComment: NewComment) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * The block a whole-block comment is being written on, or null
   */
  pendingBlock: BlockBox | null;

  /**
   * The doc on the page, or null until it has rendered
   */
  rendered: RenderedDocument | null;

  selectedThreadId: number | null;
  selectionComment: SelectionComment | null;
}

/**
 * The controls laid over the rendered doc: the gutter down its left, + beside the block the pointer picks, a frame
 * around the block a comment is for, a numbered marker beside each thread's passage, and Comment beside the selected
 * text
 */
export function DocumentControls({
  blockIndexLevelWith,
  document: shown,
  hoveredBlock,
  isBlockButtonFocused,
  markers,
  onBlockButtonFocusChange,
  onComment,
  onSelectThread,
  pendingBlock,
  rendered,
  selectedThreadId,
  selectionComment,
}: DocumentControlsProps): JSX.Element {
  // A comment is sent with the hash of the rendering it was made on, which lags the source while a newer one renders
  const commentOnBlock = (blockIndex: number | null): void => {
    const anchor =
      rendered === null || blockIndex === null ? null : blockPassage(rendered.documentText, shown.path, blockIndex);
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
      <BlockGutter hoveredBlock={hoveredBlock} onComment={(clientY) => commentOnBlock(blockIndexLevelWith(clientY))} />
      {pendingBlock !== null && <BlockTarget box={pendingBlock} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock.box}
          isFocused={isBlockButtonFocused}
          isFramed={pendingBlock?.index === hoveredBlock.box.index}
          isPointerInGutter={hoveredBlock.isPointerInGutter}
          onComment={() => commentOnBlock(hoveredBlock.box.index)}
          onFocusChange={onBlockButtonFocusChange}
        />
      )}
      <ThreadMarkers markers={markers} onSelectThread={onSelectThread} selectedThreadId={selectedThreadId} />
      {selectionComment !== null && (
        <Button
          className={styles.selectionButton}
          onClick={() => commentOnSelection(selectionComment)}
          onMouseDown={(event) => event.preventDefault()}
          size="sm"
          // Moves left by however much of the button would stick out past the room it may use, as a translate's
          // percentage is of the button's own width
          style={{
            left: selectionComment.left,
            top: selectionComment.top,
            translate: `min(0px, ${selectionComment.roomToRight}px - 100%)`,
          }}
          data-md-ignore=""
        >
          Comment
        </Button>
      )}
    </>
  );
}
