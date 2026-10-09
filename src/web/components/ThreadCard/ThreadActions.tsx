import { Alert, Button, Cluster, Divider, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { CommentForm } from "../CommentForm/CommentForm";

import { Message } from "./Message";
import styles from "./ThreadCard.module.css";

export interface ThreadActionsProps {
  /**
   * Called after an action changes the thread on the server
   */
  onChanged: () => void;

  thread: Thread;
}

/**
 * The user's part in a thread: their draft, or its editor while they write, and what they can do next
 */
export function ThreadActions({ onChanged, thread }: ThreadActionsProps): JSX.Element {
  const api = useReviewApi();
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const { draft, id, status } = thread;
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
  if (editor.editingThreadId === id) {
    const discard = (): void => {
      if (editor.isSaving) {
        return;
      }
      void run(() => api.deleteDraft(id));
    };
    return (
      <>
        <CommentForm
          label={editorLabelOf(thread)}
          leading={
            draft === undefined ? undefined : (
              <Button onClick={discard} size="sm" variant="outline">
                Discard
              </Button>
            )
          }
        />
        {refusal}
      </>
    );
  }
  return (
    <Stack gap={2}>
      {draft !== undefined && <SavedDraft body={draft.body} isReply={status !== "draft"} />}
      <Cluster gap={2} justify="end">
        {status === "open" && (
          <Button onClick={() => void run(() => api.resolveThread(id))} size="sm" variant="outline">
            Resolve
          </Button>
        )}
        <Button onClick={() => editor.request({ kind: "thread", threadId: id })} size="sm" variant="secondary">
          {draft === undefined ? "Reply" : "Edit"}
        </Button>
      </Cluster>
      {refusal}
    </Stack>
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
