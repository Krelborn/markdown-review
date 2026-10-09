import type { JSX, ReactNode } from "react";

import type { NewComment } from "../../review/NewComment";
import { NewCommentMenu } from "../NewCommentMenu/NewCommentMenu";

import styles from "./CommentsHeader.module.css";

export interface CommentsHeaderProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;

  /**
   * The start of the header, such as the title and its count
   */
  title: ReactNode;
}

/**
 * The top of the comments: their title, and the button that starts a comment on the doc or on the whole review
 */
export function CommentsHeader({ documentPath, onComment, title }: CommentsHeaderProps): JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      <NewCommentMenu documentPath={documentPath} onComment={onComment} />
    </div>
  );
}
