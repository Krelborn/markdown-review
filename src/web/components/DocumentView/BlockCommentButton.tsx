import { AddIcon, IconButton } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useEffect, useState } from "react";

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

  onComment: () => void;

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
  onFocusChange,
}: BlockCommentButtonProps): JSX.Element {
  const [isPointedAt, setIsPointedAt] = useState(false);
  // Removing the + while it has the focus fires no blur, so the focus is reported lost here
  useEffect(() => () => onFocusChange(false), [onFocusChange]);
  return (
    <>
      {(isFocused || isPointedAt || isPointerInGutter) && !isFramed && <BlockTarget box={block} />}
      <IconButton
        className={clsx(styles.blockButton, { [styles.pickingBlockButton ?? ""]: isPointerInGutter })}
        label="Comment on this block"
        onBlur={() => onFocusChange(false)}
        onClick={onComment}
        onFocus={() => onFocusChange(true)}
        onPointerEnter={() => setIsPointedAt(true)}
        onPointerLeave={() => setIsPointedAt(false)}
        placement="start"
        size="sm"
        style={{ top: block.firstLineMiddle }}
        variant="ghost"
        data-md-ignore=""
      >
        <AddIcon />
      </IconButton>
    </>
  );
}
