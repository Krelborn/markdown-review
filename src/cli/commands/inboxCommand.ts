import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatInbox } from "../formatInbox";
import { readDocumentOption } from "../readDocumentOption";

export async function inboxCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { document: { type: "string" } } });
  const root = await findRoot(terminal.workingDirectory);
  const document = await readDocumentOption(root, terminal.workingDirectory, values.document);
  const client = await connectToServer(root, cliPath);
  terminal.stdout(formatInbox(await client.inbox(document)));
  return 0;
}
