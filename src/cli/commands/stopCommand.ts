import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { waitUntilStopped } from "../connectToServer";
import { findRoot } from "../findRoot";
import { findServer } from "../findServer";

export async function stopCommand(args: string[], { terminal }: CliContext): Promise<number> {
  parseArgs({ args, options: {} });
  const root = await findRoot(terminal.workingDirectory);
  const found = await findServer(root);
  if (found.kind !== "ready" && found.kind !== "older") {
    terminal.stdout(
      `No review server is running for ${root} that this markdown-review can stop.\n\nnext_step: None.\n`
    );
    return 0;
  }
  await found.client.shutdown();
  await waitUntilStopped(found.client);
  terminal.stdout(
    `Stopped the review server for ${root}.\n\nnext_step: None; any markdown-review command starts it again.\n`
  );
  return 0;
}
