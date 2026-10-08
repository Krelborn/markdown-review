import { packageVersion } from "../server/runtime/packageVersion";

import type { CliContext } from "./CliContext";
import { CliError } from "./CliError";
import { replyCommand, resolveCommand } from "./commands/agentThreadCommands";
import { inboxCommand } from "./commands/inboxCommand";
import { installSkillCommand } from "./commands/installSkillCommand";
import { openCommand } from "./commands/openCommand";
import { pollCommand } from "./commands/pollCommand";
import { serveCommand } from "./commands/serveCommand";
import { stopCommand } from "./commands/stopCommand";
import { helpText } from "./helpText";
import { ServerRequestError } from "./ServerRequestError";

type Command = (args: string[], context: CliContext) => Promise<number>;

const commands: Record<string, Command> = {
  inbox: inboxCommand,
  "install-skill": installSkillCommand,
  open: openCommand,
  poll: pollCommand,
  reply: replyCommand,
  resolve: resolveCommand,
  serve: serveCommand,
  stop: stopCommand,
};

/**
 * Runs one CLI invocation
 *
 * @param commandLine the arguments after the program name
 * @param context where to write output and how to start the server
 * @returns the process exit code: 0 on success, 1 when the command failed, 2 for a usage error
 */
export async function runCli(commandLine: string[], context: CliContext): Promise<number> {
  const { terminal } = context;
  const [name, ...args] = commandLine;
  if (name === "--version") {
    terminal.stdout(`${packageVersion}\n`);
    return 0;
  }
  if (name === "--help" || name === "-h" || name === "help") {
    terminal.stdout(helpText());
    return 0;
  }
  if (name === undefined) {
    terminal.stderr(`error: no command given\n\n${helpText()}\nnext_step: Run one of the commands above.\n`);
    return 2;
  }
  const command = commands[name];
  if (command === undefined) {
    terminal.stderr(`error: unknown command ${name}\n\n${helpText()}\nnext_step: Run one of the commands above.\n`);
    return 2;
  }
  if (args.includes("--help") || args.includes("-h")) {
    terminal.stdout(helpText(name));
    return 0;
  }
  try {
    return await command(args, context);
  } catch (error) {
    return reportFailure(error, name, context);
  }
}

function reportFailure(error: unknown, name: string, { terminal }: CliContext): number {
  if (error instanceof CliError) {
    terminal.stderr(`error: ${error.message}\n\nnext_step: ${error.nextStep}\n`);
    return error.exitCode;
  }
  if (error instanceof ServerRequestError) {
    terminal.stderr(
      `error: the review server refused the request: ${error.message}\n\nnext_step: Fix what it reports and run the command again.\n`
    );
    return 1;
  }
  if (error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")) {
    terminal.stderr(`error: ${error.message}\n\nnext_step: Run \`markdown-review ${name} --help\`.\n`);
    return 2;
  }
  terminal.stderr(
    `error: ${error instanceof Error ? error.message : String(error)}\n\nnext_step: Run the command again; if it keeps failing, read .markdown-review/server.log.\n`
  );
  return 1;
}
