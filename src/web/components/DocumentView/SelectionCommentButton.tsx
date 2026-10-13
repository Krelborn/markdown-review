import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import styles from "./DocumentView.module.css";
import type { SelectionComment } from "./useSelectionComment";

export interface SelectionCommentButtonProps {
  /**
   * Called with the selected passage when the user clicks Comment
   */
  onComment: (selectionComment: SelectionComment) => void;

  /**
   * The selected passage and where its selection ends, or null when no text of the doc is selected
   */
  selectionComment: SelectionComment | null;
}

/**
 * Comment, beside where the selected text ends
 */
export function SelectionCommentButton({
  onComment,
  selectionComment,
}: SelectionCommentButtonProps): JSX.Element | null {
  if (selectionComment === null) {
    return null;
  }
  return (
    <div className={styles.selectionLane} style={{ top: selectionComment.top }}>
      {/* Reaches to where the selection ends, and gives way when Comment would pass the end of the lane */}
      <span style={{ flexBasis: selectionComment.left }} />
      <Button
        className={styles.selectionButton}
        onClick={() => onComment(selectionComment)}
        onMouseDown={(event) => event.preventDefault()}
        size="sm"
        data-md-ignore=""
      >
        Comment
      </Button>
    </div>
  );
}
