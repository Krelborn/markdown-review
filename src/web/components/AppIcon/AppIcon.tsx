import type { JSX } from "react";

import styles from "./AppIcon.module.css";

/**
 * The app's icon, the Markdown mark in a speech bubble. It is hidden from screen readers, so name the link or button
 * that holds it. The favicon in `index.html` draws the same icon.
 */
export function AppIcon(): JSX.Element {
  return (
    <svg className={styles.appIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        className={styles.bubble}
        d="M5 2.5h14a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3h-8.25L6.5 21.5V18H5a3 3 0 0 1-3-3V5.5a3 3 0 0 1 3-3Z"
      />
      <path className={styles.mark} d="M5.75 13.5v-7l2.75 3.25 2.75-3.25v7M16.25 6.5v7M13.75 11l2.5 2.5 2.5-2.5" />
    </svg>
  );
}
