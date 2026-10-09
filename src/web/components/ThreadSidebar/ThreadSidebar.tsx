import { Counter, Segment, SegmentedControl, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { CommentEditorContext } from "../../review/CommentEditorContext";
import { groupThreads } from "../../review/groupThreads";
import type { CommentEditor } from "../../review/useCommentEditor";
import { useSeenMessages } from "../../review/useSeenMessages";
import { CommentsHeader } from "../CommentsHeader/CommentsHeader";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface ThreadSidebarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * The page's comment editor, which the sidebar shows as the composer or inside the card of the thread it writes to
   */
  editor: CommentEditor;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

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
 * The comments beside the doc: a header that starts comments on the doc or the review, the composer while the user
 * writes one, and the threads grouped as drafts, open, outdated and resolved, for this doc or for every doc
 */
export function ThreadSidebar({
  documentPath,
  editor,
  onChanged,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
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
  return (
    <CommentEditorContext value={editor}>
      <Stack as="aside" gap={4} aria-label="Comments">
        <CommentsHeader
          documentPath={documentPath}
          onComment={(comment) => editor.request({ comment, kind: "new" })}
          title={
            <Text weight="bold">
              Comments <Counter count={visible.length} />
            </Text>
          }
        />
        {editor.newComment !== null && (
          <NewCommentForm
            documentPath={documentPath}
            key={JSON.stringify(editor.newComment.anchor)}
            newComment={editor.newComment}
          />
        )}
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
        <ThreadGroup
          isFolded={true}
          isForcedOpen={groups.resolved.some((thread) => thread.id === editor.editingThreadId)}
          threads={groups.resolved}
          title="Resolved"
          {...listProps}
        />
      </Stack>
    </CommentEditorContext>
  );
}
