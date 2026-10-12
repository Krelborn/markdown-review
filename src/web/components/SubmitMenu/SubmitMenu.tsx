import { Alert, Button, Cluster, Counter, Popover, Stack, Text, usePopover, VisuallyHidden } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useRef, useState } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import type { DraftCount } from "../../review/countDraftsByDocument";

import { DraftsSummary } from "./DraftsSummary";
import { VerdictChoice } from "./VerdictChoice";

export interface SubmitMenuProps {
  /**
   * Whether the agent has a poll open, waiting for the user to submit
   */
  agentWaiting: boolean;

  /**
   * The user's drafts on each doc: new comments and replies
   */
  drafts: DraftCount[];

  /**
   * Whether the comment editor holds text the user has not saved, which they must save or discard before submitting
   */
  hasUnsavedText: boolean;

  /**
   * Called after the drafts are submitted
   */
  onSubmitted: () => void;
}

/**
 * Sends every draft to the agent with the verdict the user chooses: asking for changes, or approving the review
 */
export function SubmitMenu({ agentWaiting, drafts, hasUnsavedText, onSubmitted }: SubmitMenuProps): JSX.Element {
  const api = useReviewApi();
  const draftCount = drafts.reduce((sum, { count }) => sum + count, 0);
  // Held while the popover is open, so drafts going then can't turn a request for changes into an approval. While it is
  // shut, the verdict is the one it opens with, so the checked radio is the one it focuses
  const [heldVerdict, setHeldVerdict] = useState<Verdict | null>(null);
  const verdict = heldVerdict ?? openingVerdictOf(draftCount);
  const checkedVerdictRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = !hasUnsavedText && (verdict === "approve" || draftCount > 0);
  const popover = usePopover({
    initialFocus: checkedVerdictRef,
    onOpenChange: (open) => {
      setHeldVerdict(open ? verdict : null);
      setError(null);
    },
    placement: "top-end",
  });
  const submit = async (): Promise<void> => {
    setIsSubmitting(true);
    try {
      await api.submit(verdict);
      popover.close();
      onSubmitted();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <Button {...popover.getTriggerProps()} variant={draftCount > 0 ? "primary" : "secondary"}>
        Submit{" "}
        {draftCount > 0 && (
          <>
            <Counter count={draftCount} /> <VisuallyHidden>{draftCount === 1 ? "draft" : "drafts"}</VisuallyHidden>
          </>
        )}
      </Button>
      <Popover {...popover.getOverlayProps()} aria-label="Submit review" role="dialog">
        <Stack gap={3}>
          <Text weight="bold">Submit review</Text>
          <DraftsSummary drafts={drafts} />
          <VerdictChoice
            checkedRef={checkedVerdictRef}
            draftCount={draftCount}
            onVerdictChange={setHeldVerdict}
            verdict={verdict}
          />
          <Text as="p" size="sm" tone="muted">
            {agentWaiting
              ? "The agent is listening and will hear at once."
              : "The agent isn't listening. It will find this in its inbox when it next looks."}
          </Text>
          {hasUnsavedText && (
            <Alert tone="warning">Save or discard the comment you're writing before you submit.</Alert>
          )}
          {error !== null && (
            <Alert role="alert" tone="danger">
              {error}
            </Alert>
          )}
          <Cluster gap={2} justify="end">
            <Button onClick={popover.close} size="sm" variant="secondary">
              Cancel
            </Button>
            <Button busy={isSubmitting} disabled={!canSubmit} onClick={() => void submit()} size="sm">
              Submit
            </Button>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}

/**
 * Works out the verdict the submit popover opens with
 *
 * @param draftCount how many drafts a submit sends
 * @returns asking for changes when there are drafts, and approving otherwise
 */
function openingVerdictOf(draftCount: number): Verdict {
  return draftCount > 0 ? "request-changes" : "approve";
}
