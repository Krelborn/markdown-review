import type { JSX } from "react";

import styles from "./DocumentView.module.css";
import type { SpanBox } from "./SpanBox";

const horizontalOutset = 4;

/**
 * How far the frame reaches above and below its block
 */
export const verticalOutset = 6;

export interface BlockTargetProps {
  box: SpanBox;

  /**
   * Says what the frame holds, such as how many blocks, on its top edge; none when undefined
   */
  label?: string;
}

/**
 * Frames the blocks a comment on whole blocks is for
 */
export function BlockTarget({ box, label }: BlockTargetProps): JSX.Element {
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
    >
      {label !== undefined && <span className={styles.blockTargetLabel}>{label}</span>}
    </div>
  );
}
