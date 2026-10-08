import { Alert, Button, Cluster } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useContext, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { UnsentTextContext } from "../../review/UnsentTextContext";
import { CommentForm } from "../CommentForm/CommentForm";

export interface ThreadActionsProps {
  /**
   * Called after an action changes the thread on the server
   */
  onChanged: () => void;

  thread: Thread;
}

/**
 * What the user can do with a thread: edit or discard their draft, start a reply, or resolve it
 */
export function ThreadActions({ onChanged, thread }: ThreadActionsProps): JSX.Element {
  const api = useReviewApi();
  const { draft, id, status } = thread;
  const replyKey = `reply:${id}`;
  const kept = useContext(UnsentTextContext);
  const [isReplying, setIsReplying] = useState(() => kept?.has(replyKey) === true);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
      setError(null);
      onChanged();
    } catch (failure) {
      setError(describeFailure(failure));
    }
  };
  const saveDraft = async (body: string): Promise<void> => {
    await api.writeDraft(id, body);
    setIsReplying(false);
    onChanged();
  };
  const refusal = error !== null && (
    <Alert role="alert" tone="danger">
      {error}
    </Alert>
  );
  if (draft !== undefined) {
    return (
      <CommentForm
        clearOnSubmit={false}
        initialBody={draft.body}
        label={status === "draft" ? "Draft comment" : "Draft reply"}
        onSubmit={saveDraft}
        shouldFocus={false}
        submitLabel="Save draft"
        unsentTextKey={`draft:${id}`}
      >
        <Button onClick={() => void run(() => api.deleteDraft(id))} size="sm" variant="ghost">
          Discard draft
        </Button>
        {refusal}
      </CommentForm>
    );
  }
  if (isReplying) {
    return (
      <CommentForm
        clearOnSubmit={false}
        initialBody=""
        label="Reply"
        onCancel={() => setIsReplying(false)}
        onSubmit={saveDraft}
        shouldFocus={true}
        submitLabel="Save reply"
        unsentTextKey={replyKey}
      />
    );
  }
  return (
    <Cluster gap={2}>
      <Button onClick={() => setIsReplying(true)} size="sm" variant="secondary">
        Reply
      </Button>
      {status === "open" && (
        <Button onClick={() => void run(() => api.resolveThread(id))} size="sm" variant="outline">
          Resolve
        </Button>
      )}
      {refusal}
    </Cluster>
  );
}
