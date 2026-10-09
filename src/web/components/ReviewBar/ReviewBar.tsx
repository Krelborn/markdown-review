import { Badge, Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;
  draftCount: number;

  /**
   * Whether the comments panel is open, which matters only in a narrow window
   */
  isPanelOpen: boolean;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  /**
   * Called when the user asks to show or hide the comments panel
   */
  onTogglePanel: () => void;

  /**
   * The id of the comments panel
   */
  panelId: string;

  review: ReviewState;
}

/**
 * The bar beneath the comments: in a narrow window, a button that shows and hides them; then whether the agent is
 * listening, whether the review is approved, and the submit button
 */
export function ReviewBar({
  agentWaiting,
  draftCount,
  isPanelOpen,
  onSubmitted,
  onTogglePanel,
  panelId,
  review,
}: ReviewBarProps): JSX.Element {
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Button
        className={styles.panelToggle}
        onClick={onTogglePanel}
        variant="secondary"
        aria-controls={panelId}
        aria-expanded={isPanelOpen}
      >
        Comments
      </Button>
      <div className={styles.status}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
      </div>
      <SubmitMenu agentWaiting={agentWaiting} draftCount={draftCount} onSubmitted={onSubmitted} />
    </section>
  );
}
