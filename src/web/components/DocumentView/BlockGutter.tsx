import { clsx } from "clsx";
import type { JSX, MouseEvent, PointerEvent } from "react";

import { verticalOutset } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { SpanBox } from "./SpanBox";

export interface BlockGutterProps {
  /**
   * Called when the user clicks in the gutter, which picks the structure around the block level with the click when ⌥
   * is held
   */
  onClick: (event: MouseEvent<HTMLDivElement>) => void;

  /**
   * Called when the user presses in the gutter, where a press picks the block level with it and a drag the blocks
   * between
   */
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;

  /**
   * The blocks the gutter picks, which its bar runs beside, or null
   */
  pickedBox: SpanBox | null;
}

/**
 * The strip down the left of the doc, where the pointer picks the block level with it: while it picks blocks, it shows
 * a track and a bar beside them
 */
export function BlockGutter({ onClick, onPointerDown, pickedBox }: BlockGutterProps): JSX.Element {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the + is the control for keyboards and screen readers; the gutter only widens its target for the pointer
    <div
      className={clsx(styles.gutter, { [styles.pickingGutter ?? ""]: pickedBox !== null })}
      onClick={onClick}
      onPointerDown={onPointerDown}
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
