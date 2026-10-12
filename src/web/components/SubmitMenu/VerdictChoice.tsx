import { RadioGroup, VisuallyHidden } from "@krelborn/stylesui";
import type { JSX, Ref } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";

import { VerdictOption } from "./VerdictOption";

export interface VerdictChoiceProps {
  /**
   * How many drafts a submit sends
   */
  draftCount: number;

  onVerdictChange: (verdict: Verdict) => void;

  /**
   * The verdict the popover opens with
   */
  openingVerdict: Verdict;

  /**
   * Given to the radio of the verdict the popover opens with
   */
  openingVerdictRef: Ref<HTMLInputElement>;

  verdict: Verdict;
}

/**
 * The verdicts the user can submit with: asking for changes, which needs a draft, or approving the review
 */
export function VerdictChoice({
  draftCount,
  onVerdictChange,
  openingVerdict,
  openingVerdictRef,
  verdict,
}: VerdictChoiceProps): JSX.Element {
  const refFor = (value: Verdict): Ref<HTMLInputElement> | undefined =>
    value === openingVerdict ? openingVerdictRef : undefined;
  return (
    <RadioGroup
      label={<VisuallyHidden>Verdict</VisuallyHidden>}
      onValueChange={(value) => onVerdictChange(value === "approve" ? "approve" : "request-changes")}
      value={verdict}
    >
      <VerdictOption
        description="Send your comments and ask the agent to revise."
        isDisabled={draftCount === 0}
        label="Request changes"
        ref={refFor("request-changes")}
        value="request-changes"
      />
      <VerdictOption
        description={draftCount === 0 ? "End the review." : "Send your comments and end the review."}
        isDisabled={false}
        label="Approve"
        ref={refFor("approve")}
        value="approve"
      />
    </RadioGroup>
  );
}
