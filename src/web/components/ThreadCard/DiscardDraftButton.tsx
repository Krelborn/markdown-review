import { Button, Cluster, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX, ToggleEvent } from "react";
import { useRef, useState } from "react";

import styles from "./ThreadCard.module.css";

export interface DiscardDraftButtonProps {
  /**
   * Whether the draft is a reply on a thread, rather than a new comment
   */
  isReply: boolean;

  /**
   * Whether the draft's editor is saving it, while which Discard is disabled
   */
  isSaving: boolean;

  /**
   * Deletes the draft, once the user confirms
   *
   * @returns a promise that settles when the delete ends, whether or not it succeeded
   */
  onDiscard: () => Promise<void>;
}

/**
 * Discard, which asks the user to confirm before it deletes their draft
 */
export function DiscardDraftButton({ isReply, isSaving, onDiscard }: DiscardDraftButtonProps): JSX.Element {
  const [isDiscarding, setIsDiscarding] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popover = usePopover({ placement: "top" });
  const overlayProps = popover.getOverlayProps();
  const title = isReply ? "Discard this reply?" : "Discard this comment?";
  // Focus goes back to Discard only from inside the popover, as on Escape: a click outside leaves it where the user
  // clicked. Whether it was inside is known only before the popover hides, which moves it out
  const returnsFocusRef = useRef(false);
  const noteFocus = (event: ToggleEvent<HTMLElement>): void => {
    returnsFocusRef.current = event.newState === "closed" && event.currentTarget.contains(document.activeElement);
  };
  const moveFocus = (event: ToggleEvent<HTMLElement>): void => {
    if (event.newState === "open") {
      cancelRef.current?.focus();
    } else if (returnsFocusRef.current) {
      triggerRef.current?.focus();
    }
  };
  // WebKit doesn't focus a button the user clicks, so focus may not be on Cancel when the user presses it
  const cancel = (): void => {
    triggerRef.current?.focus();
    popover.close();
  };
  const confirm = async (): Promise<void> => {
    setIsDiscarding(true);
    await onDiscard();
    setIsDiscarding(false);
    popover.close();
  };
  return (
    <>
      <Button {...popover.getTriggerProps()} disabled={isSaving} ref={triggerRef} size="sm" variant="secondary">
        Discard
      </Button>
      <Popover
        {...overlayProps}
        className={styles.confirmation}
        onBeforeToggle={(event) => {
          overlayProps.onBeforeToggle(event);
          noteFocus(event);
        }}
        onToggle={(event) => {
          overlayProps.onToggle(event);
          moveFocus(event);
        }}
        aria-label={title}
        role="dialog"
      >
        <Stack gap={2}>
          <Text size="sm" weight="bold">
            {title}
          </Text>
          <Text as="p" size="sm" tone="muted">
            It hasn't been sent, and you can't get it back.
          </Text>
          <Cluster gap={2} justify="end">
            <Button onClick={cancel} ref={cancelRef} size="sm" variant="secondary">
              Cancel
            </Button>
            <Button busy={isDiscarding} onClick={() => void confirm()} size="sm" variant="secondary">
              Discard
            </Button>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}
