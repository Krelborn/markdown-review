import type { AgentThreadResponse } from "../shared/api/apiResponseSchemas";

import { formatIdList } from "./formatIdList";
import { approvedStep } from "./nextSteps";

/**
 * Confirms an agent reply or resolve and says what is left
 *
 * @param action what the agent did
 * @param response the thread after the action and the inbox that remains
 * @returns the confirmation, the threads still needing the agent, and a `next_step`
 */
export function formatAgentAction(action: "replied" | "resolved", { inbox, thread }: AgentThreadResponse): string {
  const done = action === "resolved" ? `Resolved #${thread.id}.` : `Replied to #${thread.id}; it waits for the user.`;
  const remaining = inbox.threads.map((remainingThread) => remainingThread.id);
  if (remaining.length > 0) {
    const count = remaining.length === 1 ? "1 thread still needs you" : `${remaining.length} threads still need you`;
    return (
      `${done}\n${count}: ${formatIdList(remaining)}.\n\nnext_step: Address ${formatIdList(remaining)}, then run ` +
      '`markdown-review resolve <id> "<what changed>"`, or `markdown-review reply <id> "<question>"` if you need input.\n'
    );
  }
  const step = inbox.review.approved
    ? approvedStep
    : "Run `markdown-review poll` to wait for the user's next round of comments.";
  return `${done} No threads need you now.\n\nnext_step: ${step}\n`;
}
