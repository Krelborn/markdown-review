import { parseArgs } from "node:util";

import { roundOutcome } from "../../shared/review/roundOutcome";
import type { CliContext } from "../CliContext";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatInbox } from "../formatInbox";
import { readDocumentOption } from "../readDocumentOption";
import { readUpdateNotices } from "../readUpdateNotices";

export async function inboxCommand(args: string[], context: CliContext): Promise<number> {
  const { cliPath, terminal } = context;
  const { values } = parseArgs({ args, options: { document: { type: "string" } } });
  const root = await findRoot(terminal.workingDirectory);
  const client = await connectToServer(root, cliPath);
  const document = await readDocumentOption(root, terminal.workingDirectory, values.document, client);
  const inbox = await client.inbox(document);
  const notices = roundOutcome(inbox.round) === "go-ahead" ? await readUpdateNotices(context, root, true) : [];
  terminal.stdout(formatInbox(inbox, notices));
  return 0;
}
