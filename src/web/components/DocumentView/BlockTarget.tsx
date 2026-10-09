import type { JSX } from "react";

import type { BlockBox } from "./BlockBox";
import styles from "./DocumentView.module.css";

const horizontalOutset = 4;

const verticalOutset = 6;

export interface BlockTargetProps {
  box: BlockBox;
}

/**
 * Frames the block a whole-block comment is for
 */
export function BlockTarget({ box }: BlockTargetProps): JSX.Element {
  return (
    <div
      className={styles.blockTarget}
      style={{
        height: box.height + 2 * verticalOutset,
        left: box.left - horizontalOutset,
        top: box.top - verticalOutset,
        width: box.width + 2 * horizontalOutset,
      }}
      aria-hidden="true"
      data-md-ignore=""
      data-testid="block-target"
    />
  );
}
