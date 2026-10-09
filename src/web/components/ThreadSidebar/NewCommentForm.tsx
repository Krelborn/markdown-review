import { Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

import type { NewComment } from "../../review/NewComment";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { CommentForm } from "../CommentForm/CommentForm";
import { SaveShortcutHint } from "../CommentForm/SaveShortcutHint";
import { Quote } from "../Quote/Quote";

import styles from "./NewCommentForm.module.css";

export interface NewCommentFormProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  newComment: NewComment;
}

/**
 * The composer for a comment the user has started: what it is on, and the editor. It scrolls to the top of the list
 * each time the user starts a comment, so all of it is in view.
 */
export function NewCommentForm({ documentPath, newComment: { anchor } }: NewCommentFormProps): JSX.Element {
  const composerRef = useRef<HTMLElement>(null);
  const { focusRevision } = useCommentEditorContext();
  // Runs again each time the editor is asked for, which changes focusRevision
  useEffect(() => {
    composerRef.current?.scrollIntoView({ block: "start" });
  }, [focusRevision]);
  const location = locationOf(anchor, documentPath);
  return (
    <Card as="section" className={styles.composer} padding="sm" ref={composerRef} aria-label="New comment">
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <Text size="sm" weight="bold">
            New comment
          </Text>
          {location !== null && (
            <Text size="sm" tone="muted">
              {location}
            </Text>
          )}
        </Cluster>
        {anchor.kind === "passage" && <Quote isPending={true} text={anchor.quote} />}
        <CommentForm label={labelOf(anchor)} leading={<SaveShortcutHint />} />
      </Stack>
    </Card>
  );
}

function locationOf(anchor: NewComment["anchor"], documentPath: string | null): string | null {
  if (anchor.kind === "review") {
    return "Whole review";
  }
  if (anchor.document !== documentPath) {
    return anchor.document;
  }
  return anchor.kind === "document" ? "Whole doc" : null;
}

function labelOf(anchor: NewComment["anchor"]): string {
  switch (anchor.kind) {
    case "review":
      return "Comment on the whole review";
    case "document":
      return "Comment on the whole doc";
    case "passage":
      return "Comment";
  }
}
