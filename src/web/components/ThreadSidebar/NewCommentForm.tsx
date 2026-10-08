import { Card, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import { useReviewApi } from "../../api/useReviewApi";
import type { NewComment } from "../../review/NewComment";
import { CommentForm } from "../CommentForm/CommentForm";
import { Quote } from "../Quote/Quote";

export interface NewCommentFormProps {
  newComment: NewComment;
  onChanged: () => void;

  /**
   * Called when the user saves or cancels the comment
   */
  onClose: () => void;
}

/**
 * Asks the user to write the comment they started in the doc, and saves it as a draft
 */
export function NewCommentForm({ newComment, onChanged, onClose }: NewCommentFormProps): JSX.Element {
  const api = useReviewApi();
  const { anchor } = newComment;
  const save = async (body: string): Promise<void> => {
    await api.createThread({ ...newComment, body });
    onChanged();
    onClose();
  };
  return (
    <Card as="section" padding="sm" aria-label="New comment">
      <Stack gap={2}>
        {anchor.kind === "passage" && <Quote text={anchor.quote} />}
        <CommentForm
          clearOnSubmit={false}
          initialBody=""
          label={anchor.kind === "document" ? "Comment on the whole doc" : "Comment"}
          onCancel={onClose}
          onSubmit={save}
          shouldFocus={true}
          submitLabel="Save draft"
        />
      </Stack>
    </Card>
  );
}
