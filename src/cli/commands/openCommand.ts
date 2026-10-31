import { parseArgs } from "node:util";

import openInBrowser from "open";

import { nextTaskSchema } from "../../shared/review/reviewRoundSchema";
import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { locateDocument } from "../locateDocument";
import { waitForCommentsInRootStep, waitForCommentsStep } from "../nextSteps";
import { readUpdateNotices } from "../readUpdateNotices";

export async function openCommand(args: string[], context: CliContext): Promise<number> {
  const { cliPath, terminal } = context;
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args,
    options: { "next-task": { type: "string" } },
  });
  if (positionals.length > 1) {
    throw new CliError("open takes at most one path", "Run `markdown-review open [path]`.", 2);
  }
  const nextTask = readNextTask(values["next-task"]);
  const target = positionals[0];
  const workingRoot = await findRoot(terminal.workingDirectory);
  const { document, root } =
    target === undefined ? { document: null, root: workingRoot } : await locate(terminal.workingDirectory, target);
  const client = await connectToServer(root, cliPath);
  const { navigated, url } = await client.open(document, nextTask);
  const shown = navigated ? "Shown in the browser tab that was already open." : await openUrl(url, terminal.env);
  const nextStep = root === workingRoot ? waitForCommentsStep : waitForCommentsInRootStep(root);
  const notices = await readUpdateNotices(context, root, false);
  const noticeSection = notices.length > 0 ? `${notices.join("")}\n` : "";
  terminal.stdout(
    `Opened ${document ?? "the docs list"} for review: ${url}\n${shown}\n\n${noticeSection}next_step: ${nextStep}\n`
  );
  return 0;
}

function readNextTask(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const result = nextTaskSchema.safeParse(value);
  if (!result.success) {
    throw new CliError(
      "--next-task must be one line of at most 200 characters",
      'Run `markdown-review open <doc.md> --next-task "<what you will do once the user says go ahead>"`.',
      2
    );
  }
  return result.data;
}

async function locate(workingDirectory: string, target: string): Promise<{ document: string; root: string }> {
  const located = await locateDocument(workingDirectory, target);
  if (located.kind !== "file") {
    throw new CliError(`${target} is not a file`, "Check the path and run `markdown-review open <path>` again.");
  }
  return located;
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
