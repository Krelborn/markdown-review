import { Badge, Button } from "@krelborn/stylesui";
import type { JSX, RefObject } from "react";

import type { ReviewRound } from "../../../shared/review/reviewRoundSchema";
import { roundOutcome } from "../../../shared/review/roundOutcome";
import type { DraftCounts } from "../../review/countDraftsByDocument";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./ReviewBar.module.css";

export interface ReviewBarProps {
  agentWaiting: boolean;

  /**
   * The user's drafts on each doc, split into those a submit sends and those it keeps
   */
  drafts: DraftCounts;

  /**
   * Whether the comment editor holds text the user has not saved
   */
  hasUnsavedText: boolean;

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

  /**
   * The Comments button, which takes focus when the panel closes with focus inside it
   */
  panelToggleRef: RefObject<HTMLButtonElement | null>;

  /**
   * The review round, or null before the agent first opened a review
   */
  round: ReviewRound | null;
}

/**
 * The bar beneath the comments, on one row: in a narrow window, a button that shows and hides them; then whether the
 * agent is listening, how the user ended the review round if they have, and Submit
 */
export function ReviewBar({
  agentWaiting,
  drafts,
  hasUnsavedText,
  isPanelOpen,
  onSubmitted,
  onTogglePanel,
  panelId,
  panelToggleRef,
  round,
}: ReviewBarProps): JSX.Element {
  const outcome = roundOutcome(round);
  return (
    <section className={styles.reviewBar} aria-label="Review">
      <Button
        className={styles.panelToggle}
        onClick={onTogglePanel}
        ref={panelToggleRef}
        variant="secondary"
        aria-controls={panelId}
        aria-expanded={isPanelOpen}
      >
        Comments
      </Button>
      <div className={styles.status}>
        <AgentStatus agentWaiting={agentWaiting} />
        {outcome === "go-ahead" && (
          <Badge tone="success" variant="solid">
            Going ahead
          </Badge>
        )}
        {outcome === "hand-back" && (
          <Badge tone="neutral" variant="solid">
            Handed back
          </Badge>
        )}
      </div>
      <SubmitMenu
        agentWaiting={agentWaiting}
        drafts={drafts}
        hasUnsavedText={hasUnsavedText}
        nextTask={round?.nextTask ?? null}
        onSubmitted={onSubmitted}
      />
    </section>
  );
}
