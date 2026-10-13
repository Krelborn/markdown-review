import { formatIdList } from "./formatIdList";

export const pollTimeoutAdvice =
  "Give the shell command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background and `--timeout 7080`.";

export const waitForCommentsStep = `Run \`markdown-review poll\` to wait for the user's comments. ${pollTimeoutAdvice}`;

/**
 * @param root the root of a doc opened from outside its repository
 */
export function waitForCommentsInRootStep(root: string): string {
  return (
    `This doc belongs to the repository at ${root}, so run markdown-review commands from that directory. ` +
    waitForCommentsStep
  );
}

export const wentAheadStep =
  "The user said go ahead. Carry on with your task; do not run `markdown-review poll` again for this review.";

export const handedBackStep =
  "Stop here: do not edit the docs, run `markdown-review poll` or carry on with your task. " +
  "Tell the user in the chat that you have stopped, and wait for their instructions.";

export const handedBackFinishedStep =
  "The user handed the review back. Tell them what you changed and wait for their instructions; run " +
  "`markdown-review open <path>` and `markdown-review poll` only if they ask you to continue the review.";

/**
 * @param ids the threads that need the agent, at least one
 */
export function addressThreadsStep(ids: readonly number[]): string {
  return (
    `Edit the docs, then run \`markdown-review resolve <id> "<what changed>"\` for ${formatIdList(ids)}, ` +
    'or `markdown-review reply <id> "<question>"` if you need input. ' +
    "Then run `markdown-review poll` to wait for the next round."
  );
}

/**
 * @param ids the threads the user commented on when saying go ahead, at least one
 */
export function wentAheadWithCommentsStep(ids: readonly number[]): string {
  const resolveCommand =
    ids.length === 1
      ? `\`markdown-review resolve ${ids[0]} "<what changed>"\``
      : '`markdown-review resolve <id> "<what changed>"` for each';
  return (
    `The user said go ahead, with comments. Address ${formatIdList(ids)} and run ${resolveCommand}, ` +
    "then carry on with your task; do not run `markdown-review poll` again for this review."
  );
}

/**
 * @param ids the threads still needing the agent after the user handed the review back, at least one
 */
export function handedBackThreadsLeftStep(ids: readonly number[]): string {
  return `The user handed the review back, so act on ${formatIdList(ids)} only as they ask in the chat.`;
}

/**
 * @param ids the threads the user commented on when handing the review back, at least one
 */
export function handedBackWithCommentsStep(ids: readonly number[]): string {
  return (
    `Stop here: do not edit the docs, resolve or reply to ${formatIdList(ids)}, run \`markdown-review poll\` or ` +
    "carry on with your task. Tell the user in the chat that you have stopped and what their comments say, and wait " +
    "for their instructions."
  );
}
