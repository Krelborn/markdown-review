import { Alert, Button, Cluster, Field, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";
import { useUnsentText } from "../../review/useUnsentText";

export interface CommentFormProps {
  /**
   * Further actions shown after the submit button, such as discarding a draft
   */
  children?: ReactNode;

  /**
   * Whether the text box empties once the text is saved, ready for another comment
   */
  clearOnSubmit: boolean;

  initialBody: string;
  label: string;
  onCancel?: () => void;

  /**
   * Saves the text; when it rejects, the form shows the error and keeps the text
   */
  onSubmit: (body: string) => Promise<void>;

  /**
   * Whether the text box takes focus when the form appears
   */
  shouldFocus: boolean;

  submitLabel: string;

  /**
   * Names the box, so text the user has typed and not saved outlives it, as when its thread moves to another group
   */
  unsentTextKey?: string;
}

/**
 * A text box for a comment, a reply or a draft, with the button that saves it
 */
export function CommentForm({
  children,
  clearOnSubmit,
  initialBody,
  label,
  onCancel,
  onSubmit,
  shouldFocus,
  submitLabel,
  unsentTextKey,
}: CommentFormProps): JSX.Element {
  const { body, change, forget } = useUnsentText(unsentTextKey, initialBody);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (shouldFocus) {
      textareaRef.current?.focus();
    }
  }, [shouldFocus]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(body);
      setError(null);
      if (clearOnSubmit) {
        change("");
      }
      forget();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)}>
      <Field label={label}>
        <Textarea onChange={(event) => change(event.target.value)} ref={textareaRef} rows={3} value={body} />
      </Field>
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      <Cluster gap={2}>
        <Button busy={isSaving} disabled={body.trim() === "" || body === initialBody} size="sm" type="submit">
          {submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button
            onClick={() => {
              forget();
              onCancel();
            }}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        )}
        {children}
      </Cluster>
    </Stack>
  );
}
