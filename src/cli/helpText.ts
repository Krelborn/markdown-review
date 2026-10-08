const commandHelp: Record<string, string> = {
  inbox: [
    "markdown-review inbox [--document <path>]",
    "  Print whether the review is approved and the threads that need you, then return at once.",
  ].join("\n"),
  open: [
    "markdown-review open [path]",
    "  Start a review round and show the doc (or the docs list) in the user's browser. Prints the URL.",
  ].join("\n"),
  poll: [
    "markdown-review poll [--document <path>] [--timeout <seconds>]",
    "  Wait until the user submits or approves, then print what needs you. The timeout defaults to 540 seconds.",
    "  Give the shell command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background",
    "  and --timeout 7080.",
  ].join("\n"),
  reply: [
    "markdown-review reply <id> <text>",
    "markdown-review reply <id> --file <path>   (--file - reads standard input)",
    "  Answer a thread without resolving it, for example to ask the user a question.",
  ].join("\n"),
  resolve: [
    "markdown-review resolve <id> [text]",
    "markdown-review resolve <id> --file <path>   (--file - reads standard input)",
    "  Resolve a thread, optionally saying what changed.",
  ].join("\n"),
  stop: ["markdown-review stop", "  Stop the review server for this repository."].join("\n"),
};

/**
 * @param command a command name, or undefined for every command
 * @returns usage text for the command, or for the whole CLI
 */
export function helpText(command?: string): string {
  const named = command === undefined ? undefined : commandHelp[command];
  if (named !== undefined) {
    return `${named}\n`;
  }
  return [
    "Markdown Review: the user reviews your markdown in a browser; you read and answer their comments here.",
    "",
    ...Object.values(commandHelp),
    "",
    "Run `markdown-review <command> --help` for one command. Every command ends with a next_step line.",
    "",
  ].join("\n");
}
