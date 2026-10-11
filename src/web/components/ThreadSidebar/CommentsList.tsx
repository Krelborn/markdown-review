import { Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useEffect, useEffectEvent, useRef } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { groupThreads } from "../../review/groupThreads";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { useSeenMessages } from "../../review/useSeenMessages";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface CommentsListProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called after the list changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Counts the user's selections, selecting the selected thread again included
   */
  selectionCount: number;

  /**
   * Whether to head each doc's threads with its path
   */
  showsDocuments: boolean;

  /**
   * The threads to list
   */
  threads: Thread[];
}

/**
 * The comments under the header: the composer while the user starts a comment, then the threads in their groups
 */
export function CommentsList({
  documentPath,
  onChanged,
  onSelectThread,
  selectedThreadId,
  selectionCount,
  showsDocuments,
  threads,
}: CommentsListProps): JSX.Element {
  const editor = useCommentEditorContext();
  const seen = useSeenMessages();
  const markSelectedSeen = useEffectEvent(() => {
    const selected = threads.find(({ id }) => id === selectedThreadId);
    if (selected !== undefined) {
      seen.markSeen(selected);
    }
  });
  // Selecting a thread by its highlight or marker in the doc shows it as surely as its card's location does. Only a
  // selection counts: a reply that arrives while its thread stays selected is still new, and so is one waiting when
  // the list mounts again, as it does when the other docs' threads come or go
  const markedSelectionCountRef = useRef(selectionCount);
  useEffect(() => {
    if (selectionCount !== markedSelectionCountRef.current) {
      markedSelectionCountRef.current = selectionCount;
      markSelectedSeen();
    }
  }, [selectionCount]);
  const groups = groupThreads(threads);
  const listProps = {
    hasNewAgentMessage: seen.hasNewAgentMessage,
    onChanged,
    onSeen: seen.markSeen,
    onSelect: (thread: Thread) => {
      seen.markSeen(thread);
      onSelectThread(thread);
    },
    selectedThreadId,
    showsDocuments,
  };
  return (
    <Stack gap={4}>
      {editor.newComment !== null && (
        <NewCommentForm
          documentPath={documentPath}
          key={JSON.stringify(editor.newComment.anchor)}
          newComment={editor.newComment}
        />
      )}
      {threads.length === 0 && editor.newComment === null && (
        <Text as="p" size="sm" tone="muted">
          No comments yet. Select text in the doc, or press + beside a block, to comment on it.
        </Text>
      )}
      <ThreadGroup isFolded={false} threads={groups.drafts} title="Drafts" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.open} title="Open" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.outdated} title="Outdated" {...listProps} />
      <ThreadGroup
        isFolded={true}
        isForcedOpen={groups.resolved.some((thread) => thread.id === editor.editingThreadId)}
        newReplyCount={groups.resolved.filter(seen.hasNewAgentMessage).length}
        threads={groups.resolved}
        title="Resolved"
        {...listProps}
      />
    </Stack>
  );
}
