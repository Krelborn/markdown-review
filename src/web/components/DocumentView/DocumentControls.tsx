import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import styles from "./DocumentView.module.css";
import type { HoveredBlock } from "./useHoveredBlock";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  hoveredBlock: HoveredBlock | null;
  markers: ThreadMarker[];
  onComment: (newComment: NewComment) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * The doc on the page, or null until it has rendered
   */
  rendered: RenderedDocument | null;

  selectedThreadId: number | null;
  selectionComment: SelectionComment | null;
}

/**
 * The buttons laid over the rendered doc: + beside the block under the pointer, a numbered marker beside each thread's
 * passage, and Comment beside the selected text
 */
export function DocumentControls({
  document: shown,
  hoveredBlock,
  markers,
  onComment,
  onSelectThread,
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
      {hoveredBlock !== null && (
        <Button
          className={styles.blockButton}
          onClick={() => commentOnBlock(hoveredBlock.index)}
          size="sm"
          style={{ top: hoveredBlock.top }}
          variant="ghost"
          aria-label="Comment on this block"
          data-md-ignore=""
        >
          +
        </Button>
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
          style={{ left: selectionComment.left, top: selectionComment.top }}
          data-md-ignore=""
        >
          Comment
        </Button>
      )}
    </>
  );
}
