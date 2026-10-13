import { RadioGroup, VisuallyHidden } from "@krelborn/stylesui";
import type { JSX, Ref } from "react";

import type { Verdict } from "../../../shared/review/reviewRoundSchema";

import { VerdictOption } from "./VerdictOption";

export interface VerdictChoiceProps {
  /**
   * Given to the checked radio
   */
  checkedRef: Ref<HTMLInputElement>;

  /**
   * How many drafts a submit sends
   */
  draftCount: number;

  onVerdictChange: (verdict: Verdict) => void;
  verdict: Verdict;
}

/**
 * The verdicts the user can submit with: asking for changes, which needs a draft, or approving the review
 */
export function VerdictChoice({ checkedRef, draftCount, onVerdictChange, verdict }: VerdictChoiceProps): JSX.Element {
  const refFor = (value: Verdict): Ref<HTMLInputElement> | undefined => (value === verdict ? checkedRef : undefined);
  return (
    <RadioGroup
      label={<VisuallyHidden>Verdict</VisuallyHidden>}
      onValueChange={(value) => onVerdictChange(value === "go-ahead" ? "go-ahead" : "revise")}
      value={verdict}
    >
      <VerdictOption
        description="Send your comments and ask the agent to revise."
        isDisabled={draftCount === 0}
        label="Request changes"
        ref={refFor("revise")}
        value="revise"
      />
      <VerdictOption
        description={draftCount === 0 ? "End the review." : "Send your comments and end the review."}
        isDisabled={false}
        label="Approve"
        ref={refFor("go-ahead")}
        value="go-ahead"
      />
    </RadioGroup>
  );
}
