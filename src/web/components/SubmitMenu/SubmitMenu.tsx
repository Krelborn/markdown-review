import { Alert, Button, Cluster, Counter, Popover, Stack, Text, usePopover, VisuallyHidden } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useRef, useState } from "react";

import type { Verdict } from "../../../shared/review/reviewRoundSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import type { DraftCounts } from "../../review/countDraftsByDocument";

import { DraftsSummary } from "./DraftsSummary";
import { VerdictChoice } from "./VerdictChoice";

export interface SubmitMenuProps {
  /**
   * Whether the agent has a poll open, waiting for the user to submit
   */
  agentWaiting: boolean;

  /**
   * The user's drafts on each doc, new comments and replies, split into those a submit sends and those it keeps
   */
  drafts: DraftCounts;

  /**
   * Whether the comment editor holds text the user has not saved, which they must save or discard before submitting
   */
  hasUnsavedText: boolean;

  /**
   * What the agent will do once the user says go ahead, or null when it has not said
   */
  nextTask: string | null;

  /**
   * Called after the drafts are submitted
   */
  onSubmitted: () => void;
}

/**
 * Sends the review's drafts to the agent with the verdict the user chooses: Revise, Go ahead or Hand back to agent
 */
export function SubmitMenu({
  agentWaiting,
  drafts,
  hasUnsavedText,
  nextTask,
  onSubmitted,
}: SubmitMenuProps): JSX.Element {
  const api = useReviewApi();
  const draftCount = drafts.sent.reduce((sum, { count }) => sum + count, 0);
  // Held while the popover is open, so drafts going then can't turn Revise into Go ahead. While it is shut, the verdict
  // is the one it opens with, so the checked radio is the one it focuses
  const [heldVerdict, setHeldVerdict] = useState<Verdict | null>(null);
  const verdict = heldVerdict ?? openingVerdictOf(draftCount);
  const checkedVerdictRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = !hasUnsavedText && (verdict !== "revise" || draftCount > 0);
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
            <Counter count={draftCount} /> <VisuallyHidden>{draftNoun(draftCount)}</VisuallyHidden>
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
            nextTask={nextTask}
            onVerdictChange={setHeldVerdict}
            verdict={verdict}
          />
          <Text as="p" size="sm" tone="muted">
            {describeListening(agentWaiting)}
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
 * @returns Revise when there are drafts, and Go ahead otherwise
 */
function openingVerdictOf(draftCount: number): Verdict {
  return draftCount > 0 ? "revise" : "go-ahead";
}

function draftNoun(count: number): string {
  return count === 1 ? "draft" : "drafts";
}

function describeListening(agentWaiting: boolean): string {
  return agentWaiting
    ? "The agent is listening and will hear at once."
    : "The agent isn't listening. It will find this in its inbox when it next looks.";
}
