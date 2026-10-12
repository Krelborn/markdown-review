import { Button, Cluster, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useRef, useState } from "react";

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
  // Cancel takes focus, so a stray Enter keeps the draft
  const popover = usePopover({ initialFocus: cancelRef, placement: "top-start" });
  const title = isReply ? "Discard this reply?" : "Discard this comment?";
  const confirm = async (): Promise<void> => {
    setIsDiscarding(true);
    await onDiscard();
    setIsDiscarding(false);
    popover.close();
  };
  return (
    <>
      <Button {...popover.getTriggerProps()} disabled={isSaving} size="sm" variant="secondary">
        Discard
      </Button>
      <Popover {...popover.getOverlayProps()} aria-label={title} role="dialog">
        <Stack gap={2}>
          <Text size="sm" weight="bold">
            {title}
          </Text>
          <Text as="p" size="sm" tone="muted">
            It hasn't been sent, and you can't get it back.
          </Text>
          <Cluster gap={2} justify="end">
            <Button onClick={popover.close} ref={cancelRef} size="sm" variant="secondary">
              Cancel
            </Button>
            <Button busy={isDiscarding} onClick={() => void confirm()} size="sm" variant="danger">
              Discard
            </Button>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}
