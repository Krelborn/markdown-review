import { clsx } from "clsx";
import type { JSX, MouseEvent, PointerEvent } from "react";
import { useRef } from "react";

import { verticalOutset } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { SpanBox } from "./SpanBox";

export interface BlockGutterProps {
  /**
   * Called with the click when the user clicks in the gutter, unless the press started a drag; with ⌥ held, a click
   * picks the structure around the block level with it
   */
  onClick: (event: MouseEvent<HTMLDivElement>) => void;

  /**
   * Called when the user presses in the gutter, to start a drag down it from the block level with the press
   *
   * @returns whether a drag started, which starts the comment when the user releases it, in place of the click
   */
  onDragStart: (event: PointerEvent<HTMLDivElement>) => boolean;

  /**
   * The blocks the gutter picks, which its bar runs beside, or null
   */
  pickedBox: SpanBox | null;
}

/**
 * The strip down the left of the doc, where the pointer picks the block level with it: while it picks blocks, it shows
 * a track and a bar beside them
 */
export function BlockGutter({ onClick, onDragStart, pickedBox }: BlockGutterProps): JSX.Element {
  const isDragClickRef = useRef(false);
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the + is the control for keyboards and screen readers; the gutter only widens its target for the pointer
    <div
      className={clsx(styles.gutter, { [styles.pickingGutter ?? ""]: pickedBox !== null })}
      onClick={(event) => {
        if (!isDragClickRef.current) {
          onClick(event);
        }
        isDragClickRef.current = false;
      }}
      onPointerDown={(event) => {
        isDragClickRef.current = onDragStart(event);
      }}
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
