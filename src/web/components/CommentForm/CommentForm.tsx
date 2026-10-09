import { Alert, Button, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import styles from "./CommentForm.module.css";

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
 * The open comment editor: its text box, then Cancel and Save
 */
export function CommentForm({ label, leading }: CommentFormProps): JSX.Element {
  const editor = useCommentEditorContext();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { focusRevision } = editor;
  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusRevision]);
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
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)}>
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
      <div className={styles.buttons}>
        {leading !== undefined && <div className={styles.leading}>{leading}</div>}
        <Button onClick={editor.close} size="sm" variant="outline">
          Cancel
        </Button>
        <Button busy={isSaving} disabled={!editor.canSave} size="sm" type="submit">
          Save
        </Button>
      </div>
    </Stack>
  );
}
