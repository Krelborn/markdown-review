import { Alert, Button, Cluster, Divider, Stack, Text } from "@krelborn/stylesui";
import type { JSX, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { CommentForm } from "../CommentForm/CommentForm";

import { DiscardDraftButton } from "./DiscardDraftButton";
import { Message } from "./Message";
import styles from "./ThreadCard.module.css";

export interface ThreadActionsProps {
  /**
   * Called after an action changes the thread on the server
   */
  onChanged: () => void;

  /**
   * Called once the user's draft comment is deleted, while its card is still on the page
   */
  onCommentDiscarded: () => void;

  /**
   * Called when the user acts on the thread, which shows them its messages
   */
  onSeen: () => void;

  thread: Thread;
}

/**
 * The user's part in a thread: their draft, or its editor while they write, and what they can do next
 */
export function ThreadActions({ onChanged, onCommentDiscarded, onSeen, thread }: ThreadActionsProps): JSX.Element {
  const api = useReviewApi();
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const replyRef = useRef<HTMLButtonElement>(null);
  const focusesReplyRef = useRef(false);
  const { draft, id, status } = thread;
  // Reply takes the place of a discarded draft reply's Edit only once the threads show the draft gone,
  // which can be before or after the deletion returns; a draft the threads show again ends the wait
  const hasDraft = draft !== undefined;
  useEffect(() => {
    if (hasDraft) {
      focusesReplyRef.current = false;
    } else if (focusesReplyRef.current) {
      focusesReplyRef.current = false;
      replyRef.current?.focus();
    }
  }, [hasDraft]);
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
      setError(null);
      onChanged();
    } catch (failure) {
      setError(describeFailure(failure));
    }
  };
  const refusal = error !== null && (
    <Alert role="alert" tone="danger">
      {error}
    </Alert>
  );
  const isReply = status !== "draft";
  const discard = (): Promise<void> =>
    run(async () => {
      onSeen();
      focusesReplyRef.current = isReply;
      try {
        await api.deleteDraft(id);
      } catch (failure) {
        focusesReplyRef.current = false;
        throw failure;
      }
      if (!isReply) {
        onCommentDiscarded();
      }
    });
  if (editor.editingThreadId === id) {
    return (
      <>
        <ThreadEditor isSaving={editor.isSaving} onDiscard={discard} thread={thread} />
        {refusal}
      </>
    );
  }
  return (
    <Stack gap={2}>
      <ReadOnlyActions
        onDiscard={discard}
        onEdit={() => {
          onSeen();
          editor.request({ kind: "thread", threadId: id });
        }}
        onResolve={() => {
          onSeen();
          void run(() => api.resolveThread(id));
        }}
        replyRef={replyRef}
        thread={thread}
      />
      {refusal}
    </Stack>
  );
}

interface ThreadEditorProps {
  isSaving: boolean;
  onDiscard: () => Promise<void>;
  thread: Thread;
}

function ThreadEditor({ isSaving, onDiscard, thread }: ThreadEditorProps): JSX.Element {
  const { draft, status } = thread;
  if (draft !== undefined) {
    return (
      <CommentForm
        label={editorLabelOf(thread)}
        leading={<DiscardDraftButton isReply={status !== "draft"} isSaving={isSaving} onDiscard={onDiscard} />}
      />
    );
  }
  return (
    <CommentForm
      label={editorLabelOf(thread)}
      leading={
        status === "resolved" ? (
          <Text size="xs" tone="muted">
            Sending reopens this thread.
          </Text>
        ) : undefined
      }
    />
  );
}

interface ReadOnlyActionsProps {
  onDiscard: () => Promise<void>;

  /**
   * Called when the user asks to reply, or to edit their draft
   */
  onEdit: () => void;

  onResolve: () => void;

  /**
   * Reply, or Edit while the thread has a draft
   */
  replyRef: RefObject<HTMLButtonElement | null>;

  thread: Thread;
}

function ReadOnlyActions({ onDiscard, onEdit, onResolve, replyRef, thread }: ReadOnlyActionsProps): JSX.Element {
  const { draft, status } = thread;
  const isReply = status !== "draft";
  return (
    <>
      {draft !== undefined && <SavedDraft body={draft.body} isReply={isReply} />}
      <Cluster gap={2} justify="end">
        {draft !== undefined && (
          <div className={styles.leading}>
            <DiscardDraftButton isReply={isReply} isSaving={false} onDiscard={onDiscard} />
          </div>
        )}
        {status === "open" && draft === undefined && (
          <Button onClick={onResolve} size="sm" variant="secondary">
            Resolve
          </Button>
        )}
        <Button onClick={onEdit} ref={replyRef} size="sm" variant="secondary">
          {draft === undefined ? "Reply" : "Edit"}
        </Button>
      </Cluster>
    </>
  );
}

function SavedDraft({ body, isReply }: { body: string; isReply: boolean }): JSX.Element {
  if (!isReply) {
    return (
      <Text as="p" className={styles.body} size="sm">
        {body}
      </Text>
    );
  }
  return (
    <>
      <Divider />
      <Message author="user" body={body} sentAt={null} />
    </>
  );
}

function editorLabelOf({ draft, status }: Thread): string {
  if (status === "draft") {
    return "Draft comment";
  }
  return draft === undefined ? "Reply" : "Draft reply";
}
