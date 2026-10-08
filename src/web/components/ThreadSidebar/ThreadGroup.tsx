import { Heading, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import styles from "./ThreadGroup.module.css";
import type { ThreadListProps } from "./ThreadList";
import { ThreadList } from "./ThreadList";

export interface ThreadGroupProps extends ThreadListProps {
  /**
   * Whether the group starts folded away, with only its title showing
   */
  isFolded: boolean;

  title: string;
}

/**
 * A titled group of thread cards, shown only when it has threads
 */
export function ThreadGroup({ isFolded, title, ...listProps }: ThreadGroupProps): JSX.Element | null {
  if (listProps.threads.length === 0) {
    return null;
  }
  const heading = (
    <Heading className={styles.heading} level={2} size="sm">
      {title} ({listProps.threads.length})
    </Heading>
  );
  return (
    <Stack as="section" gap={2} aria-label={title}>
      {isFolded ? (
        <details>
          <summary className={styles.summary}>{heading}</summary>
          <ThreadList {...listProps} />
        </details>
      ) : (
        <>
          {heading}
          <ThreadList {...listProps} />
        </>
      )}
    </Stack>
  );
}
