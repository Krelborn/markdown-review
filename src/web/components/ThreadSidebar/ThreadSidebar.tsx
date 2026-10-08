import { Segment, SegmentedControl, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { useReviewApi } from "../../api/useReviewApi";
import { groupThreads } from "../../review/groupThreads";
import type { NewComment } from "../../review/NewComment";
import { useSeenMessages } from "../../review/useSeenMessages";
import { CommentForm } from "../CommentForm/CommentForm";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface ThreadSidebarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * A comment the user started in the doc, which the sidebar asks them to write
   */
  newComment: NewComment | null;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user saves or cancels the new comment
   */
  onCloseNewComment: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Every thread in the repo
   */
  threads: Thread[];
}

/**
 * The comments beside the doc: a box for commenting on the whole review, and the threads grouped as drafts, open,
 * outdated and resolved, for this doc or for every doc
 */
export function ThreadSidebar({
  documentPath,
  newComment,
  onChanged,
  onCloseNewComment,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
  const api = useReviewApi();
  const seen = useSeenMessages();
  const [scope, setScope] = useState("document");
  const showsEveryDocument = documentPath === null || scope === "all";
  const visible = showsEveryDocument
    ? threads
    : threads.filter((thread) => thread.anchor.kind === "review" || thread.anchor.document === documentPath);
  const groups = groupThreads(visible);
  const listProps = {
    hasNewAgentMessage: seen.hasNewAgentMessage,
    onChanged,
    onSelect: (thread: Thread) => {
      seen.markSeen(thread);
      onSelectThread(thread);
    },
    selectedThreadId,
    showsDocuments: showsEveryDocument,
  };
  const commentOnReview = async (body: string): Promise<void> => {
    await api.createThread({ anchor: { kind: "review" }, body });
    onChanged();
  };
  return (
    <Stack as="aside" gap={4} aria-label="Comments">
      {newComment !== null && (
        <NewCommentForm
          key={JSON.stringify(newComment.anchor)}
          newComment={newComment}
          onChanged={onChanged}
          onClose={onCloseNewComment}
        />
      )}
      <CommentForm
        clearOnSubmit={true}
        initialBody=""
        label="Comment on the whole review"
        onSubmit={commentOnReview}
        shouldFocus={false}
        submitLabel="Add comment"
      />
      {documentPath !== null && (
        <SegmentedControl label="Show comments on" onValueChange={setScope} size="sm" value={scope}>
          <Segment value="document">This doc</Segment>
          <Segment value="all">All docs</Segment>
        </SegmentedControl>
      )}
      {visible.length === 0 && (
        <Text as="p" size="sm" tone="muted">
          No comments yet. Select text in the doc, or press + beside a block, to comment on it.
        </Text>
      )}
      <ThreadGroup isFolded={false} threads={groups.drafts} title="Drafts" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.open} title="Open" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.outdated} title="Outdated" {...listProps} />
      <ThreadGroup isFolded={true} threads={groups.resolved} title="Resolved" {...listProps} />
    </Stack>
  );
}
