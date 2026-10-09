import { clsx } from "clsx";
import type { JSX } from "react";

import styles from "./Quote.module.css";

export interface QuoteProps {
  /**
   * Whether this is the passage of the comment the user is writing, which draws its bar in the primary colour, as its
   * highlight in the doc is
   */
  isPending?: boolean;

  /**
   * The doc's text that a comment is on
   */
  text: string;
}

/**
 * The text a comment is on, cut short after a few lines
 */
export function Quote({ isPending = false, text }: QuoteProps): JSX.Element {
  return <blockquote className={clsx(styles.quote, { [styles.pending ?? ""]: isPending })}>{text}</blockquote>;
}
