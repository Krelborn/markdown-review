import { RadioGroup, VisuallyHidden } from "@krelborn/stylesui";
import type { JSX, Ref } from "react";

import type { Verdict } from "../../../shared/review/reviewRoundSchema";
import { verdictSchema } from "../../../shared/review/reviewRoundSchema";

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

  /**
   * What the agent will do once the user says go ahead, or null when it has not said
   */
  nextTask: string | null;

  onVerdictChange: (verdict: Verdict) => void;
  verdict: Verdict;
}

/**
 * The verdicts the user can submit with: Revise, which needs a draft, Go ahead, or Hand back to agent
 */
export function VerdictChoice({
  checkedRef,
  draftCount,
  nextTask,
  onVerdictChange,
  verdict,
}: VerdictChoiceProps): JSX.Element {
  const refFor = (value: Verdict): Ref<HTMLInputElement> | undefined => (value === verdict ? checkedRef : undefined);
  const hasDrafts = draftCount > 0;
  const carriesOn = nextTask === null ? "carries on with its task." : `carries on: ${nextTask}`;
  return (
    <RadioGroup
      label={<VisuallyHidden>Verdict</VisuallyHidden>}
      onValueChange={(value) => onVerdictChange(verdictSchema.parse(value))}
      value={verdict}
    >
      <VerdictOption
        description="Send your comments. The agent revises the docs, answers each one, and waits for you."
        isDisabled={!hasDrafts}
        label="Revise"
        ref={refFor("revise")}
        value="revise"
      />
      <VerdictOption
        description={
          hasDrafts
            ? `Send your comments and end the review. The agent addresses them, then ${carriesOn}`
            : `End the review. The agent ${carriesOn}`
        }
        isDisabled={false}
        label="Go ahead"
        ref={refFor("go-ahead")}
        value="go-ahead"
      />
      <VerdictOption
        description={
          hasDrafts
            ? "Send your comments and end the review. The agent stops and waits for you in the chat."
            : "End the review. The agent stops and waits for you in the chat."
        }
        isDisabled={false}
        label="Hand back to agent"
        ref={refFor("hand-back")}
        value="hand-back"
      />
    </RadioGroup>
  );
}
