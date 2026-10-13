import type { JSX } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { BlockCommentButton } from "./BlockCommentButton";
import { BlockGutter } from "./BlockGutter";
import { BlockTarget } from "./BlockTarget";
import { StructurePicker } from "./StructurePicker";
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
 * The gutter down the left of the doc: its outer lane picks the structure around a block, and the rest picks the
 * block, with the + beside it, or the blocks a drag covers
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
  const isPickingStructure = hoveredBlock?.isPointerInBracketLane === true;
  const isPickingBlock = hoveredBlock?.isPointerInGutter === true && !isPickingStructure;
  const pointedBox = isPickingBlock ? hoveredBlock.box : null;
  return (
    <>
      <BlockGutter onPointerDown={(event) => startDrag(event, onComment)} pickedBox={draggedBox ?? pointedBox} />
      <StructurePicker isPicking={isPickingStructure} offeredStructure={offeredStructure} onComment={onComment} />
      {draggedSpan !== null && draggedBox !== null && <BlockTarget box={draggedBox} label={countLabel(draggedSpan)} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock.box}
          isFocused={isBlockButtonFocused}
          isFramed={draggedSpan !== null || isSpanOf(pendingSpan, hoveredBlock.box.index)}
          isPointerInGutter={isPickingBlock}
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
