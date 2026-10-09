import { Button, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { NewComment } from "../../review/NewComment";
import { ChevronDownIcon } from "../ChevronDownIcon/ChevronDownIcon";

import styles from "./NewCommentMenu.module.css";

export interface NewCommentMenuProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Called when the user starts a comment on the doc or on the whole review
   */
  onComment: (newComment: NewComment) => void;
}

/**
 * Starts a comment on the doc on screen or on the whole review, from a menu; on the docs list, where only the review
 * can take one, a button starts it directly
 */
export function NewCommentMenu({ documentPath, onComment }: NewCommentMenuProps): JSX.Element {
  const popover = usePopover();
  const start = (newComment: NewComment): void => {
    popover.close();
    onComment(newComment);
  };
  if (documentPath === null) {
    return (
      <Button onClick={() => onComment({ anchor: { kind: "review" } })} size="sm" variant="secondary">
        + Review comment
      </Button>
    );
  }
  return (
    <>
      <Button {...popover.getTriggerProps()} size="sm" variant="secondary">
        + Comment <ChevronDownIcon />
      </Button>
      <Popover {...popover.getOverlayProps()}>
        <Stack gap={1}>
          <Button
            className={styles.item}
            onClick={() => start({ anchor: { document: documentPath, kind: "document" } })}
            size="sm"
            variant="ghost"
          >
            <span className={styles.itemText}>
              On this doc
              <Text size="xs" tone="muted" aria-hidden={true}>
                {documentPath}
              </Text>
            </span>
          </Button>
          <Button
            className={styles.item}
            onClick={() => start({ anchor: { kind: "review" } })}
            size="sm"
            variant="ghost"
          >
            <span className={styles.itemText}>
              On the whole review
              <Text size="xs" tone="muted" aria-hidden={true}>
                Every doc in this review
              </Text>
            </span>
          </Button>
        </Stack>
      </Popover>
    </>
  );
}
