import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { BlockBox } from "./BlockBox";
import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";

export interface BlockCommentButtonProps {
  block: BlockBox;

  /**
   * Whether the block is framed already, because a comment is being written on it
   */
  isFramed: boolean;

  onComment: () => void;
}

/**
 * The + beside the block under the pointer, which frames the block while the user points at it or focuses it
 */
export function BlockCommentButton({ block, isFramed, onComment }: BlockCommentButtonProps): JSX.Element {
  const [isTargeting, setIsTargeting] = useState(false);
  return (
    <>
      {isTargeting && !isFramed && <BlockTarget box={block} />}
      <Button
        className={styles.blockButton}
        onBlur={() => setIsTargeting(false)}
        onClick={onComment}
        onFocus={() => setIsTargeting(true)}
        onPointerEnter={() => setIsTargeting(true)}
        onPointerLeave={() => setIsTargeting(false)}
        size="sm"
        style={{ top: block.top }}
        variant="ghost"
        aria-label="Comment on this block"
        data-md-ignore=""
      >
        +
      </Button>
    </>
  );
}
