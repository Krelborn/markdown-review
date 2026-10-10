import { clsx } from "clsx";
import type { JSX } from "react";

import { verticalOutset } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { HoveredBlock } from "./useHoveredBlock";

export interface BlockGutterProps {
  /**
   * The block the + sits beside, or null
   */
  hoveredBlock: HoveredBlock | null;

  /**
   * Called with the distance down the page the user clicks the gutter at, to start a comment on the block level with
   * it
   */
  onComment: (clientY: number) => void;
}

/**
 * The strip down the left of the doc, where the pointer picks the block level with it: while the pointer is in it, it
 * shows a track and a bar beside that block, and a click in it starts a comment on the block
 */
export function BlockGutter({ hoveredBlock, onComment }: BlockGutterProps): JSX.Element {
  const pickedBox = hoveredBlock?.isPointerInGutter === true ? hoveredBlock.box : null;
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the + is the control for keyboards and screen readers; the gutter only widens its target for the pointer
    <div
      className={clsx(styles.gutter, { [styles.pickingGutter ?? ""]: pickedBox !== null })}
      onClick={(event) => onComment(event.clientY)}
      aria-hidden="true"
      data-md-ignore=""
      data-testid="block-gutter"
    >
      {pickedBox !== null && (
        <div
          className={styles.gutterBar}
          style={{ height: pickedBox.height + 2 * verticalOutset, top: pickedBox.top - verticalOutset }}
        />
      )}
    </div>
  );
}
