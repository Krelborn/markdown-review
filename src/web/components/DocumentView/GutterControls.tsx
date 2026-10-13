import type { JSX } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { BlockCommentButton } from "./BlockCommentButton";
import { BlockGutter } from "./BlockGutter";
import { BlockTarget } from "./BlockTarget";
import { StructureBracket } from "./StructureBracket";
import type { GutterDrag } from "./useGutterDrag";
import type { HoveredBlock } from "./useHoveredBlock";
import type { OfferedStructure } from "./useOfferedStructure";
import type { PendingSpan } from "./usePendingSpan";

export interface GutterControlsProps {
  gutterDrag: GutterDrag;

  /**
   * The block the + sits beside, or null
   */
  hoveredBlock: HoveredBlock | null;

  /**
   * Whether the + has the keyboard focus
   */
  isBlockButtonFocused: boolean;

  /**
   * The structure the gutter offers a comment on, or null
   */
  offeredStructure: OfferedStructure | null;

  /**
   * Called when the + gains or loses the keyboard focus
   */
  onBlockButtonFocusChange: (isFocused: boolean) => void;

  /**
   * Called when the user starts a comment on whole blocks
   */
  onComment: (span: BlockSpan) => void;

  /**
   * The blocks a comment on whole blocks is being written on, or null
   */
  pendingSpan: PendingSpan | null;
}

/**
 * The gutter down the left of the doc, with the bracket beside the structure it offers, the + beside the block it
 * picks, and a frame round the blocks a drag covers
 */
export function GutterControls({
  gutterDrag,
  hoveredBlock,
  isBlockButtonFocused,
  offeredStructure,
  onBlockButtonFocusChange,
  onComment,
  pendingSpan,
}: GutterControlsProps): JSX.Element {
  const { box: draggedBox, span: draggedSpan, startDrag } = gutterDrag;
  const pointedBox = hoveredBlock?.isPointerInGutter === true ? hoveredBlock.box : null;
  return (
    <>
      <BlockGutter onPointerDown={(event) => startDrag(event, onComment)} pickedBox={draggedBox ?? pointedBox} />
      {offeredStructure !== null && <StructureBracket box={offeredStructure.box} />}
      {draggedSpan !== null && draggedBox !== null && <BlockTarget box={draggedBox} label={countLabel(draggedSpan)} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock.box}
          isFocused={isBlockButtonFocused}
          isFramed={draggedSpan !== null || isSpanOf(pendingSpan, hoveredBlock.box.index)}
          isPointerInGutter={hoveredBlock.isPointerInGutter}
          onComment={() => onComment({ firstBlock: hoveredBlock.box.index, lastBlock: hoveredBlock.box.index })}
          onDragStart={(event) => startDrag(event, onComment)}
          onFocusChange={onBlockButtonFocusChange}
        />
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
