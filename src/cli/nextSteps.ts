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

export const approvedStep =
  "The user approved the review. Carry on with your task; do not run `markdown-review poll` again for this review.";

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
 * @param ids the threads the user commented on when approving, at least one
 */
export function approvedWithCommentsStep(ids: readonly number[]): string {
  const resolveCommand =
    ids.length === 1
      ? `\`markdown-review resolve ${ids[0]} "<what changed>"\``
      : '`markdown-review resolve <id> "<what changed>"` for each';
  return (
    `The user approved the review with comments. Address ${formatIdList(ids)} and run ${resolveCommand}, ` +
    "then carry on with your task; do not run `markdown-review poll` again for this review."
  );
}
