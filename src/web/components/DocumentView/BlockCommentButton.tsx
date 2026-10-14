import { AddIcon, Button } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX, MouseEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { BlockBox } from "./BlockBox";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";

export interface BlockCommentButtonProps {
  block: BlockBox;

  /**
   * Whether the block is framed already, because a comment is being written on it
   */
  isFramed: boolean;

  /**
   * Whether the + has the keyboard focus
   */
  isFocused: boolean;

  /**
   * Whether the pointer is in the gutter, where it picks the block
   */
  isPointerInGutter: boolean;

  /**
   * Called with the click when the user clicks the +, or presses it from the keyboard, unless the press started a drag
   */
  onComment: (event: MouseEvent<HTMLButtonElement>) => void;

  /**
   * Called when the user presses the +, to start a drag down the gutter from its block
   *
   * @returns whether a drag started, which starts the comment when the user releases it, in place of the click
   */
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => boolean;

  /**
   * Called when the + gains or loses the keyboard focus
   */
  onFocusChange: (isFocused: boolean) => void;
}

/**
 * The + beside the first line of the block the pointer picks, which frames the block while the user points at it, at
 * the gutter beside it, or focuses it
 */
export function BlockCommentButton({
  block,
  isFocused,
  isFramed,
  isPointerInGutter,
  onComment,
  onDragStart,
  onFocusChange,
}: BlockCommentButtonProps): JSX.Element {
  const [isPointedAt, setIsPointedAt] = useState(false);
  const isDragClickRef = useRef(false);
  // Removing the + while it has the focus fires no blur, so the focus is reported lost here
  useEffect(() => () => onFocusChange(false), [onFocusChange]);
  return (
    <>
      {(isFocused || isPointedAt || isPointerInGutter) && !isFramed && <BlockTarget box={block} />}
      {/* A Button rather than an IconButton, whose tooltip would cover the bracket lane or the comments' bars beside the
          +; the frame around the block shows what the + is for */}
      <Button
        className={clsx(styles.blockButton, { [styles.pickingBlockButton ?? ""]: isPointerInGutter })}
        onBlur={() => onFocusChange(false)}
        onClick={(event) => {
          if (!isDragClickRef.current) {
            onComment(event);
          }
          isDragClickRef.current = false;
        }}
        onFocus={() => onFocusChange(true)}
        onPointerDown={(event) => {
          isDragClickRef.current = onDragStart(event);
        }}
        onPointerEnter={() => setIsPointedAt(true)}
        onPointerLeave={() => setIsPointedAt(false)}
        size="sm"
        style={{ top: block.firstLineMiddle }}
        variant="ghost"
        aria-label="Comment on this block"
        data-md-ignore=""
      >
        <AddIcon className={styles.blockButtonIcon} />
      </Button>
    </>
  );
}
