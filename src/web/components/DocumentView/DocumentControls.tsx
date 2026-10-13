import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { BlockSpan } from "../../../shared/markdown/BlockSpan";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import { BlockCommentButton } from "./BlockCommentButton";
import { BlockGutter } from "./BlockGutter";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import { ThreadMarkers } from "./ThreadMarkers";
import type { GutterDrag } from "./useGutterDrag";
import type { HoveredBlock } from "./useHoveredBlock";
import type { PendingSpan } from "./usePendingSpan";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
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
}

/**
 * The controls laid over the rendered doc: the gutter down its left, + beside the block the pointer picks, a frame
 * around the blocks a comment is for, a numbered marker beside each thread's passage, and Comment beside the selected
 * text
 */
export function DocumentControls({
  document: shown,
  gutterDrag,
  hoveredBlock,
  isBlockButtonFocused,
  markers,
  onBlockButtonFocusChange,
  onComment,
  onSelectThread,
  pendingSpan,
  rendered,
  selectedThreadId,
  selectionComment,
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
      <BlockGutter
        onPointerDown={(event) => gutterDrag.startDrag(event, commentOnSpan)}
        pickedBox={gutterDrag.box ?? (hoveredBlock?.isPointerInGutter === true ? hoveredBlock.box : null)}
      />
      {pendingSpan !== null && <BlockTarget box={pendingSpan.box} />}
      {gutterDrag.span !== null && gutterDrag.box !== null && (
        <BlockTarget box={gutterDrag.box} label={countLabel(gutterDrag.span)} />
      )}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock.box}
          isFocused={isBlockButtonFocused}
          isFramed={gutterDrag.span !== null || isSpanOf(pendingSpan, hoveredBlock.box.index)}
          isPointerInGutter={hoveredBlock.isPointerInGutter}
          onComment={() => commentOnSpan({ firstBlock: hoveredBlock.box.index, lastBlock: hoveredBlock.box.index })}
          onFocusChange={onBlockButtonFocusChange}
        />
      )}
      <ThreadMarkers markers={markers} onSelectThread={onSelectThread} selectedThreadId={selectedThreadId} />
      {selectionComment !== null && (
        <div className={styles.selectionLane} style={{ top: selectionComment.top }}>
          {/* Reaches to where the selection ends, and gives way when Comment would pass the end of the lane */}
          <span style={{ flexBasis: selectionComment.left }} />
          <Button
            className={styles.selectionButton}
            onClick={() => commentOnSelection(selectionComment)}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            data-md-ignore=""
          >
            Comment
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * @returns how many blocks a drag covers, or nothing for one block
 */
function countLabel({ firstBlock, lastBlock }: BlockSpan): string | undefined {
  return lastBlock > firstBlock ? `${lastBlock - firstBlock + 1} blocks` : undefined;
}

function isSpanOf(span: BlockSpan | null, blockIndex: number): boolean {
  return span?.firstBlock === blockIndex && span.lastBlock === blockIndex;
}
