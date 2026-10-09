import {
  Alert,
  Button,
  Cluster,
  Counter,
  Popover,
  RadioGroup,
  Stack,
  Text,
  usePopover,
  VisuallyHidden,
} from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import type { DraftCount } from "../../review/countDraftsByDocument";

import { DraftsSummary } from "./DraftsSummary";
import { VerdictOption } from "./VerdictOption";

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
  const [verdict, setVerdict] = useState<Verdict>("approve");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const popover = usePopover({
    onOpenChange: (open) => {
      if (open) {
        setVerdict(draftCount > 0 ? "request-changes" : "approve");
        setError(null);
      }
    },
    placement: "top",
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
          <RadioGroup
            label={<VisuallyHidden>Verdict</VisuallyHidden>}
            onValueChange={(value) => setVerdict(value === "approve" ? "approve" : "request-changes")}
            value={verdict}
          >
            <VerdictOption
              description="Send your comments and ask the agent to revise."
              isDisabled={draftCount === 0}
              label="Request changes"
              value="request-changes"
            />
            <VerdictOption
              description={draftCount === 0 ? "End the review." : "Send your comments and end the review."}
              isDisabled={false}
              label="Approve"
              value="approve"
            />
          </RadioGroup>
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
            <Button onClick={popover.close} size="sm" variant="outline">
              Cancel
            </Button>
            <Button busy={isSubmitting} disabled={hasUnsavedText} onClick={() => void submit()} size="sm">
              Submit
            </Button>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}
