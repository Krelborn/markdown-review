import { parseArgs } from "node:util";

import { createConsoleLogger } from "../../server/runtime/createConsoleLogger";
import { runServer } from "../../server/runtime/runServer";
import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";

/**
 * Runs the review server in this process until it stops; the CLI starts it detached as `serve --root <root>`
 */
export async function serveCommand(args: string[], _context: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { root: { type: "string" } } });
  if (values.root === undefined) {
    throw new CliError("serve needs --root <path>", "Run `markdown-review serve --root <repository root>`.", 2);
  }
  const server = await runServer({ logger: createConsoleLogger(), root: values.root });
  const stop = (): void => {
    server
      .close()
      .catch((error: unknown) => process.stderr.write(`The server did not stop cleanly: ${String(error)}\n`));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await server.closed;
  return 0;
}
