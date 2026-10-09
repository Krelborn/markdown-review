import type { JSX, ReactNode } from "react";

import type { NewComment } from "../../review/NewComment";
import { NewCommentMenu } from "../NewCommentMenu/NewCommentMenu";

import styles from "./CommentsHeader.module.css";

export interface CommentsHeaderProps {
  /**
   * The button that hides the comments, which shows only in a narrow window
   */
  closeButton: ReactNode;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;

  /**
   * The tabs that choose which threads to list, which fill a second row under the title and the buttons; left out when
   * there is nothing to choose
   */
  tabs?: ReactNode;

  /**
   * The start of the header's first row: the title, and its count when there are no tabs to carry the counts
   */
  title: ReactNode;
}

/**
 * The top of the comments, which stays in view as they scroll: a row with their title, the button that starts a comment
 * on the doc or the review and, in a narrow window, the button that hides them; and, when given, the tabs on a row below
 */
export function CommentsHeader({
  closeButton,
  documentPath,
  onComment,
  tabs,
  title,
}: CommentsHeaderProps): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <div className={styles.title}>{title}</div>
        <div className={styles.actions}>
          <NewCommentMenu documentPath={documentPath} onComment={onComment} />
          <div className={styles.closeButton}>{closeButton}</div>
        </div>
      </div>
      {tabs}
    </header>
  );
}
