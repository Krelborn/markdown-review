import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import type { CliTerminal } from "../CliTerminal";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatAgentAction } from "../formatAgentAction";
import { formatIdList } from "../formatIdList";
import { readMessageBody } from "../readMessageBody";
import { readThreadIdArgument } from "../readThreadIdArgument";
import type { ServerClient } from "../ServerClient";
import { ServerRequestError } from "../ServerRequestError";

export async function replyCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { id, message } = await readArguments(args, terminal, 'markdown-review reply <id> "<text>"');
  if (message === null) {
    throw new CliError("reply needs the text of the reply", 'Run `markdown-review reply <id> "<text>"`.', 2);
  }
  const client = await connectToServer(await findRoot(terminal.workingDirectory), cliPath);
  const response = await explainUnknownThread(client, id, () => client.reply(id, message));
  terminal.stdout(formatAgentAction("replied", response));
  return 0;
}

export async function resolveCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { id, message } = await readArguments(args, terminal, 'markdown-review resolve <id> "<what changed>"');
  const client = await connectToServer(await findRoot(terminal.workingDirectory), cliPath);
  const response = await explainUnknownThread(client, id, () => client.resolve(id, message));
  terminal.stdout(formatAgentAction("resolved", response));
  return 0;
}

/**
 * Reads the thread ID and the message, before anything connects to the server
 */
async function readArguments(
  args: string[],
  terminal: CliTerminal,
  usage: string
): Promise<{ id: number; message: string | null }> {
  const { positionals, values } = parseArgs({ allowPositionals: true, args, options: { file: { type: "string" } } });
  const [idWord, ...words] = positionals;
  return { id: readThreadIdArgument(idWord, usage), message: await readMessageBody(words, values.file, terminal) };
}

/**
 * Turns the server's "unknown thread" into an error that lists the threads the agent can act on
 */
async function explainUnknownThread<Result>(
  client: ServerClient,
  id: number,
  action: () => Promise<Result>
): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof ServerRequestError) || error.reason !== "unknown-thread") {
      throw error;
    }
    const waiting = (await client.inbox(null)).threads.map((thread) => thread.id);
    const known =
      waiting.length === 0 ? "No threads need you." : `The threads that need you are ${formatIdList(waiting)}.`;
    throw new CliError(`No thread #${id} is waiting for you. ${known}`, "Run `markdown-review inbox` to see them.");
  }
}
