import { Alert, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import { CommentFormButtons } from "./CommentFormButtons";
import { UnsavedQuestion } from "./UnsavedQuestion";
import { useEditorKeys } from "./useEditorKeys";

export interface CommentFormProps {
  /**
   * Names the text box for screen readers
   */
  label: string;

  /**
   * Shown at the start of the row of buttons, away from Save, such as the button that discards a draft
   */
  leading?: ReactNode;
}

/**
 * The open comment editor: its text box and buttons, and, while it holds text the user might lose, what to do with it
 */
export function CommentForm({ label, leading }: CommentFormProps): JSX.Element {
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { escape, focusRevision, question } = editor;
  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusRevision]);
  useEditorKeys(formRef, escape);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await editor.save();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)} ref={formRef}>
      {question !== null && <UnsavedQuestion isDraft={editor.savedBody !== null} question={question} />}
      <Textarea
        onChange={(event) => editor.changeBody(event.target.value)}
        ref={textareaRef}
        rows={3}
        value={editor.body}
        aria-label={label}
      />
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      <CommentFormButtons isSaving={isSaving} leading={leading} />
    </Stack>
  );
}
