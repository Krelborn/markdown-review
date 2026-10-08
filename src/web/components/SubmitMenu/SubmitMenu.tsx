import { Alert, Button, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";

export interface SubmitMenuProps {
  /**
   * The drafts in the whole repo: new comments and replies
   */
  draftCount: number;

  /**
   * Called after the drafts are submitted
   */
  onSubmitted: () => void;
}

/**
 * Sends every draft to the agent, either asking for changes or approving the review
 */
export function SubmitMenu({ draftCount, onSubmitted }: SubmitMenuProps): JSX.Element {
  const api = useReviewApi();
  const popover = usePopover({ placement: "bottom" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Verdict | null>(null);
  const submit = async (verdict: Verdict): Promise<void> => {
    setSubmitting(verdict);
    try {
      await api.submit(verdict);
      setError(null);
      popover.close();
      onSubmitted();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setSubmitting(null);
    }
  };
  return (
    <>
      <Button {...popover.getTriggerProps()}>Submit ({draftCount})</Button>
      <Popover {...popover.getOverlayProps()} aria-label="Submit review" role="dialog">
        <Stack gap={2}>
          <Text as="p" size="sm">
            {draftCount === 0
              ? "You have no drafts. Approve to tell the agent to carry on."
              : `Sends ${draftCount === 1 ? "1 draft" : `${draftCount} drafts`} to the agent.`}
          </Text>
          <Button
            busy={submitting === "request-changes"}
            disabled={draftCount === 0}
            onClick={() => void submit("request-changes")}
            variant="secondary"
          >
            Request changes
          </Button>
          <Button busy={submitting === "approve"} onClick={() => void submit("approve")}>
            Approve
          </Button>
          {error !== null && (
            <Alert role="alert" tone="danger">
              {error}
            </Alert>
          )}
        </Stack>
      </Popover>
    </>
  );
}
