import { Badge, Cluster } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;
  draftCount: number;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  review: ReviewState;
}

/**
 * The bar beneath the comments: whether the agent is listening, whether the review is approved, and the submit button
 */
export function ReviewBar({ agentWaiting, draftCount, onSubmitted, review }: ReviewBarProps): JSX.Element {
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Cluster gap={3}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
      </Cluster>
      <SubmitMenu draftCount={draftCount} onSubmitted={onSubmitted} />
    </section>
  );
}
