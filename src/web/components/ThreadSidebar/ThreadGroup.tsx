import { Counter, Heading, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import styles from "./ThreadGroup.module.css";
import type { ThreadListProps } from "./ThreadList";
import { ThreadList } from "./ThreadList";

export interface ThreadGroupProps extends ThreadListProps {
  /**
   * Whether the group starts folded away, with only its title showing; the user opens and closes it from then on
   */
  isFolded: boolean;

  /**
   * Whether one of its threads is being edited, which opens a folded group and keeps it open
   */
  isForcedOpen?: boolean;

  title: string;
}

/**
 * A titled group of thread cards, shown only when it has threads
 */
export function ThreadGroup({
  isFolded,
  isForcedOpen = false,
  title,
  ...listProps
}: ThreadGroupProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  if (isForcedOpen && !isOpen) {
    setIsOpen(true);
  }
  if (listProps.threads.length === 0) {
    return null;
  }
  const heading = (
    <Heading className={styles.heading} level={2} size="xs" tone="muted">
      {title} <Counter count={listProps.threads.length} />
    </Heading>
  );
  return (
    <Stack as="section" gap={2} aria-label={title}>
      {isFolded ? (
        <details onToggle={(event) => setIsOpen(event.currentTarget.open)} open={isOpen}>
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
