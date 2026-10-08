import type { JSX } from "react";

import styles from "./Quote.module.css";

export interface QuoteProps {
  /**
   * The doc's text that a comment is on
   */
  text: string;
}

/**
 * The text a comment is on, cut short after a few lines
 */
export function Quote({ text }: QuoteProps): JSX.Element {
  return <blockquote className={styles.quote}>{text}</blockquote>;
}
