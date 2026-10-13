import type { AgentThreadResponse } from "../shared/api/apiResponseSchemas";
import type { RoundOutcome } from "../shared/review/roundOutcome";
import { roundOutcome } from "../shared/review/roundOutcome";

import { formatIdList } from "./formatIdList";
import { wentAheadStep } from "./nextSteps";

/**
 * Confirms an agent reply or resolve and says what is left
 *
 * @param action what the agent did
 * @param response the thread after the action and the inbox that remains
 * @returns the confirmation, the threads still needing the agent, and a `next_step`
 */
export function formatAgentAction(action: "replied" | "resolved", { inbox, thread }: AgentThreadResponse): string {
  const done = action === "resolved" ? `Resolved #${thread.id}.` : `Replied to #${thread.id}; it waits for the user.`;
  const outcome = roundOutcome(inbox.round);
  const remaining = inbox.threads.map((remainingThread) => remainingThread.id);
  if (remaining.length > 0) {
    const count = remaining.length === 1 ? "1 thread still needs you" : `${remaining.length} threads still need you`;
    const step =
      outcome === "hand-back"
        ? `The user handed the review back, so act on ${formatIdList(remaining)} only as they ask in the chat.`
        : `Address ${formatIdList(remaining)}, then run \`markdown-review resolve <id> "<what changed>"\`, or ` +
          '`markdown-review reply <id> "<question>"` if you need input.';
    return `${done}\n${count}: ${formatIdList(remaining)}.\n\nnext_step: ${step}\n`;
  }
  return `${done} No threads need you now.\n\nnext_step: ${finishedStep(outcome)}\n`;
}

function finishedStep(outcome: RoundOutcome | null): string {
  switch (outcome) {
    case "go-ahead":
      return wentAheadStep;
    case "hand-back":
      return (
        "The user handed the review back. Tell them what you changed and wait for their instructions; run " +
        "`markdown-review open <path>` and `markdown-review poll` only if they ask you to continue the review."
      );
    case null:
      return "Run `markdown-review poll` to wait for the user's next round of comments.";
  }
}
