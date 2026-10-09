import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatInbox } from "../formatInbox";
import { pollTimeoutAdvice } from "../nextSteps";
import { readDocumentOption } from "../readDocumentOption";
import { ServerRequestError } from "../ServerRequestError";

const defaultTimeoutSeconds = 540;

const interruptedExitCodes: Record<string, number> = { SIGINT: 130, SIGTERM: 143 };

export async function pollCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { document: { type: "string" }, timeout: { type: "string" } } });
  const timeoutSeconds = readTimeout(values.timeout);
  const root = await findRoot(terminal.workingDirectory);
  const document = await readDocumentOption(root, terminal.workingDirectory, values.document);
  const client = await connectToServer(root, cliPath);
  const abort = new AbortController();
  let interruptedBy: string | undefined;
  const onSignal = (signal: NodeJS.Signals): void => {
    interruptedBy = signal;
    abort.abort();
  };
  // Listens before saying it is waiting, as an agent may interrupt it the moment it reads that
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    terminal.stderr(
      `Waiting up to ${timeoutSeconds}s for review comments. If this is interrupted, run \`markdown-review poll\` again; nothing is lost.\n`
    );
    const result = await client.poll(document, timeoutSeconds, abort.signal);
    if (result.timedOut && result.threads.length === 0 && !result.review.approved) {
      terminal.stdout(
        `No comments yet.\n\nnext_step: Run \`markdown-review poll\` again to keep waiting. ${pollTimeoutAdvice}\n`
      );
    } else {
      terminal.stdout(formatInbox(result));
    }
    return 0;
  } catch (error) {
    if (interruptedBy !== undefined) {
      terminal.stderr(
        "Interrupted while waiting. Nothing was lost; run `markdown-review poll` again to keep waiting.\n"
      );
      return interruptedExitCodes[interruptedBy] ?? 1;
    }
    if (error instanceof ServerRequestError) {
      throw error;
    }
    throw new CliError(
      "The review server stopped while you were waiting",
      "Run `markdown-review poll` again; it starts the server again and nothing was lost."
    );
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}

function readTimeout(value: string | undefined): number {
  if (value === undefined) {
    return defaultTimeoutSeconds;
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new CliError(
      `--timeout must be a whole number of seconds, not ${value}`,
      "Run `markdown-review poll --timeout 540`.",
      2
    );
  }
  return Number(value);
}
