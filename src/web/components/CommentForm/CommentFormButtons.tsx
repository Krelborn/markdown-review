import { Button } from "@krelborn/stylesui";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { useCommentEditorContext } from "../../review/useCommentEditorContext";

import styles from "./CommentForm.module.css";

export interface CommentFormButtonsProps {
  /**
   * Whether the editor is saving, which marks Save busy
   */
  isSaving: boolean;

  /**
   * Shown at the start of the row while the editor is not asking, away from Save
   */
  leading?: ReactNode;
}

/**
 * The editor's buttons: Cancel and Save, or, while it asks about unsaved text, Discard, Keep editing and Save
 */
export function CommentFormButtons({ isSaving, leading }: CommentFormButtonsProps): JSX.Element {
  const editor = useCommentEditorContext();
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const isAsking = editor.question !== null;
  const { questionRevision } = editor;
  // questionRevision is not read: it re-runs the effect each time the editor asks again
  useEffect(() => {
    if (isAsking) {
      const save = saveRef.current;
      (save !== null && !save.disabled ? save : keepEditingRef.current)?.focus();
    }
  }, [isAsking, questionRevision]);
  const start = isAsking ? (
    <Button onClick={editor.discardChanges} size="sm" variant="outline">
      {editor.savedBody === null ? "Discard" : "Discard changes"}
    </Button>
  ) : (
    leading
  );
  return (
    <div className={styles.buttons}>
      {start !== undefined && <div className={styles.leading}>{start}</div>}
      <Button onClick={isAsking ? editor.keepEditing : editor.close} ref={keepEditingRef} size="sm" variant="outline">
        {isAsking ? "Keep editing" : "Cancel"}
      </Button>
      <Button busy={isSaving} disabled={!editor.canSave} ref={saveRef} size="sm" type="submit">
        Save
      </Button>
    </div>
  );
}
