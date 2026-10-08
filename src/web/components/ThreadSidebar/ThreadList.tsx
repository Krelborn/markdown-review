import { Heading, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { ThreadCard } from "../ThreadCard/ThreadCard";

export interface ThreadListProps {
  hasNewAgentMessage: (thread: Thread) => boolean;
  onChanged: () => void;
  onSelect: (thread: Thread) => void;
  selectedThreadId: number | null;

  /**
   * Whether to head each doc's threads with the doc's path, for a list that holds several docs
   */
  showsDocuments: boolean;

  /**
   * Sorted so each doc's threads are together
   */
  threads: Thread[];
}

/**
 * Thread cards, under a heading for each doc when they come from several
 */
export function ThreadList({ showsDocuments, threads, ...cardProps }: ThreadListProps): JSX.Element {
  return (
    <Stack gap={2}>
      {threads.map((thread, index) => {
        const source = sourceOf(thread);
        const previous = threads[index - 1];
        return (
          <Stack gap={2} key={thread.id}>
            {showsDocuments && (previous === undefined || sourceOf(previous) !== source) && (
              <Heading level={3} size="xs" tone="muted">
                {source}
              </Heading>
            )}
            <ThreadCard
              hasNewAgentMessage={cardProps.hasNewAgentMessage(thread)}
              isSelected={thread.id === cardProps.selectedThreadId}
              onChanged={cardProps.onChanged}
              onSelect={cardProps.onSelect}
              thread={thread}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}

function sourceOf({ anchor }: Thread): string {
  return anchor.kind === "review" ? "Whole review" : anchor.document;
}
