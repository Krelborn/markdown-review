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
   * The start of the header: the title and its count, or the tabs that choose which threads to list
   */
  title: ReactNode;
}

/**
 * The top of the comments, which stays in view as they scroll: their title or tabs, the button that starts a comment on
 * the doc or the review, and in a narrow window the button that hides them
 */
export function CommentsHeader({ closeButton, documentPath, onComment, title }: CommentsHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      <div className={styles.actions}>
        <NewCommentMenu documentPath={documentPath} onComment={onComment} />
        <div className={styles.closeButton}>{closeButton}</div>
      </div>
    </div>
  );
}
