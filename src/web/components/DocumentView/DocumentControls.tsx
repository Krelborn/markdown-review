import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import type { BlockBox } from "./BlockBox";
import { BlockCommentButton } from "./BlockCommentButton";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  /**
   * The block under the pointer, or null
   */
  hoveredBlock: BlockBox | null;

  markers: ThreadMarker[];
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
 * The controls laid over the rendered doc: + beside the block under the pointer, a frame around the block a comment is
 * for, a numbered marker beside each thread's passage, and Comment beside the selected text
 */
export function DocumentControls({
  document: shown,
  hoveredBlock,
  markers,
  onComment,
  onSelectThread,
  pendingBlock,
  rendered,
  selectedThreadId,
  selectionComment,
}: DocumentControlsProps): JSX.Element {
  const commentOnBlock = (blockIndex: number): void => {
    const anchor = rendered === null ? null : blockPassage(rendered.documentText, shown.path, blockIndex);
    if (anchor !== null) {
      onComment({ anchor, renderedHash: shown.hash });
    }
  };
  const commentOnSelection = ({ anchor }: SelectionComment): void => {
    onComment({ anchor, renderedHash: shown.hash });
    document.getSelection()?.removeAllRanges();
  };
  return (
    <>
      {pendingBlock !== null && <BlockTarget box={pendingBlock} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock}
          isFramed={pendingBlock?.index === hoveredBlock.index}
          onComment={() => commentOnBlock(hoveredBlock.index)}
        />
      )}
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={styles.marker}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          size="sm"
          style={{ insetInlineEnd: `${column * 2}rem`, top }}
          variant={threadId === selectedThreadId ? "primary" : "secondary"}
          aria-label={`Thread #${threadId}`}
          aria-pressed={threadId === selectedThreadId}
          data-md-ignore=""
        >
          {threadId}
        </Button>
      ))}
      {selectionComment !== null && (
        <Button
          className={styles.selectionButton}
          onClick={() => commentOnSelection(selectionComment)}
          onMouseDown={(event) => event.preventDefault()}
          size="sm"
          // Moves left by however much of the button would stick out past the view, as a translate's percentage is of
          // the button's own width
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
