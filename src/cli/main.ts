#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { createProcessTerminal } from "./createProcessTerminal";
import { runCli } from "./runCli";

process.exitCode = await runCli(process.argv.slice(2), {
  cliPath: fileURLToPath(import.meta.url),
  terminal: createProcessTerminal(),
});
