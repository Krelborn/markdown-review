import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import openInBrowser from "open";

import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { waitForCommentsStep } from "../nextSteps";
import { toRepositoryPath } from "../toRepositoryPath";

export async function openCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true, args, options: {} });
  if (positionals.length > 1) {
    throw new CliError("open takes at most one path", "Run `markdown-review open [path]`.", 2);
  }
  const target = positionals[0];
  const { document, root } =
    target === undefined
      ? { document: null, root: await findRoot(terminal.workingDirectory) }
      : await locate(terminal.workingDirectory, target);
  const client = await connectToServer(root, cliPath);
  const { navigated, url } = await client.open(document);
  const shown = navigated ? "Shown in the browser tab that was already open." : await openUrl(url, terminal.env);
  terminal.stdout(
    `Opened ${document ?? "the docs list"} for review: ${url}\n${shown}\n\nnext_step: ${waitForCommentsStep}\n`
  );
  return 0;
}

async function locate(workingDirectory: string, target: string): Promise<{ document: string; root: string }> {
  const absolutePath = path.resolve(workingDirectory, target);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null || !found.isFile()) {
    throw new CliError(`${target} is not a file`, "Check the path and run `markdown-review open <path>` again.");
  }
  const root = await findRoot(path.dirname(absolutePath));
  return { document: toRepositoryPath(root, await realpath(absolutePath)), root };
}

async function openUrl(url: string, env: Partial<Record<string, string>>): Promise<string> {
  if (env.MARKDOWN_REVIEW_NO_BROWSER === "1") {
    return "Not opened in a browser because MARKDOWN_REVIEW_NO_BROWSER is set; give the user the URL.";
  }
  try {
    await openInBrowser(url);
    return "Opened in the user's browser.";
  } catch {
    return "Could not open a browser; give the user the URL.";
  }
}
