import { Alert } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { EditorQuestion, HeldRequest } from "../../review/useCommentEditor";

export interface UnsavedQuestionProps {
  /**
   * Whether the editor changes a saved draft, rather than writing a new comment or reply
   */
  isDraft: boolean;

  question: EditorQuestion;
}

/**
 * Asks the user what to do with text they have not saved, and says what is waiting on the answer
 */
export function UnsavedQuestion({ isDraft, question: { held } }: UnsavedQuestionProps): JSX.Element {
  return (
    <Alert role="alert" title={titleOf(isDraft, held !== null)} tone="warning">
      {held === null ? null : describeHeld(held)}
    </Alert>
  );
}

function titleOf(isDraft: boolean, isHolding: boolean): string {
  const text = isDraft ? "your changes" : "this comment";
  return isHolding ? `Save ${text} first?` : `Save ${text}?`;
}

function describeHeld(held: HeldRequest): string {
  switch (held.kind) {
    case "comment":
      return "You started another comment.";
    case "edit":
      return `You started editing #${held.threadId}.`;
    case "reply":
      return `You started a reply to #${held.threadId}.`;
  }
}
