import type { JSX, MouseEvent } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { BlockCommentButton } from "./BlockCommentButton";
import { BlockGutter } from "./BlockGutter";
import { BlockTarget } from "./BlockTarget";
import { StructurePicker } from "./StructurePicker";
import type { GutterDrag } from "./useGutterDrag";
import type { HoveredBlock } from "./useHoveredBlock";
import { useIsAltKeyDown } from "./useIsAltKeyDown";
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
 * block, with the + beside it, the blocks a drag covers, or with ⌥ held the structure. One frame goes round the blocks
 * a comment is being written on, and moves to the blocks a drag covers while the user drags.
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
  const isAltKeyDown = useIsAltKeyDown();
  const { isPickingBlock, isPickingStructure } = pickingIn(hoveredBlock, {
    isAltKeyDown,
    isDragging: draggedSpan !== null,
    isOffering: offeredStructure !== null,
  });
  const pointedBox = isPickingBlock && hoveredBlock !== null ? hoveredBlock.box : null;
  // One frame, so that a click on the gutter moves it rather than drawing it again and fading it in
  const targetBox = draggedBox ?? pendingSpan?.box ?? null;
  // With ⌥ held, a click picks the structure around the block, or the block when no structure holds it
  const commentOnClick = (event: MouseEvent, blockIndex: number): void => {
    const blockSpan = { firstBlock: blockIndex, lastBlock: blockIndex };
    onComment(event.altKey ? (offeredStructure?.structure ?? blockSpan) : blockSpan);
  };
  return (
    <>
      <BlockGutter
        onClick={(event) => {
          if (event.altKey && hoveredBlock !== null) {
            commentOnClick(event, hoveredBlock.box.index);
          }
        }}
        onPointerDown={(event) => startDrag(event, onComment)}
        pickedBox={draggedBox ?? pointedBox}
      />
      <StructurePicker isPicking={isPickingStructure} offeredStructure={offeredStructure} onComment={onComment} />
      {targetBox !== null && <BlockTarget box={targetBox} label={countLabel(draggedSpan)} />}
      {hoveredBlock !== null && (
        <BlockCommentButton
          block={hoveredBlock.box}
          isFocused={isBlockButtonFocused}
          isFramed={draggedSpan !== null || isSpanOf(pendingSpan, hoveredBlock.box.index)}
          isPointerInGutter={isPickingBlock}
          onComment={(event) => commentOnClick(event, hoveredBlock.box.index)}
          onDragStart={(event) => startDrag(event, onComment)}
          onFocusChange={onBlockButtonFocusChange}
        />
      )}
    </>
  );
}

interface PickingState {
  isAltKeyDown: boolean;
  isDragging: boolean;

  /**
   * Whether the gutter offers a structure around the block it picks
   */
  isOffering: boolean;
}

/**
 * @returns whether the gutter picks the block level with the pointer, or the structure around it: in the bracket lane,
 *   or elsewhere in the gutter with ⌥ held while it offers a structure and the user is not dragging
 */
function pickingIn(
  hoveredBlock: HoveredBlock | null,
  { isAltKeyDown, isDragging, isOffering }: PickingState
): { isPickingBlock: boolean; isPickingStructure: boolean } {
  const isInGutter = hoveredBlock?.isPointerInGutter === true;
  const isPickingStructure =
    hoveredBlock?.isPointerInBracketLane === true || (isInGutter && isAltKeyDown && isOffering && !isDragging);
  return { isPickingBlock: isInGutter && !isPickingStructure, isPickingStructure };
}

/**
 * @returns how many blocks a drag covers, or nothing for one block or when the user is not dragging
 */
function countLabel(span: BlockSpan | null): string | undefined {
  return span !== null && span.lastBlock > span.firstBlock
    ? `${span.lastBlock - span.firstBlock + 1} blocks`
    : undefined;
}

function isSpanOf(span: BlockSpan | null, blockIndex: number): boolean {
  return span?.firstBlock === blockIndex && span.lastBlock === blockIndex;
}
