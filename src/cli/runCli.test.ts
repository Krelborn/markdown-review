import { execFile } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import { packageVersion } from "../server/runtime/packageVersion";
import type { RunningServer } from "../server/runtime/runServer";
import { runServer } from "../server/runtime/runServer";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { pollTimeoutAdvice, waitForCommentsStep } from "./nextSteps";
import { runCli } from "./runCli";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("runCli", () => {
  test("must print the package version when asked for it", async () => {
    const { run } = await setUpTest();

    expect(await run(["--version"])).toEqual({ exitCode: 0, stderr: "", stdout: `${packageVersion}\n` });
  });

  test("must print one command's usage when the command is given --help", async () => {
    const { run } = await setUpTest();

    const { exitCode, stdout } = await run(["poll", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout.split("\n")[0]).toBe("markdown-review poll [--document <path>] [--timeout <seconds>]");
  });

  test.each([
    { condition: "no command is given", args: [], message: "error: no command given" },
    { condition: "the command is unknown", args: ["approve"], message: "error: unknown command approve" },
    { condition: "an option is unknown", args: ["poll", "--wait"], message: "error: Unknown option '--wait'" },
    { condition: "the thread ID is not a number", args: ["resolve", "abc"], message: "error: Expected a thread ID" },
    { condition: "a reply has no text", args: ["reply", "1"], message: "error: reply needs the text of the reply" },
    {
      condition: "the poll timeout is not a number",
      args: ["poll", "--timeout", "soon"],
      message: "error: --timeout must be",
    },
  ])("must exit 2 with the error and a next_step when $condition", async ({ args, message }) => {
    const { run } = await setUpTest();

    const { exitCode, stderr } = await run(args);

    expect(exitCode).toBe(2);
    expect(stderr.startsWith(message)).toBe(true);
    expect(stderr).toContain("next_step: ");
  });

  test("must exit 1 and say how to fix the path when the doc to open does not exist", async () => {
    const { run } = await setUpTest();

    const { exitCode, stderr } = await run(["open", "docs/missing.md"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: docs/missing.md is not a file\n\nnext_step: Check the path and run `markdown-review open <path>` again.\n"
    );
  });

  test("must use the working directory as the root when the doc is in a subdirectory outside git", async () => {
    const { run } = await setUpTest({ inGit: false, withServer: true });

    const { exitCode, stdout } = await run(["open", "docs/plan.md"]);

    expect(exitCode).toBe(0);
    expect(stdout).toBe(
      `Opened docs/plan.md for review: http://127.0.0.1:${running?.port}/document/docs/plan.md\n` +
        "Not opened in a browser because MARKDOWN_REVIEW_NO_BROWSER is set; give the user the URL.\n\n" +
        `next_step: ${waitForCommentsStep}\n`
    );
  });

  test("must refuse the doc when it is outside the working directory and neither is in git", async () => {
    const { root, run } = await setUpTest({ inGit: false });
    await writeFile(path.join(root, "..", "elsewhere.md"), "# Elsewhere\n");

    const { exitCode, stderr } = await run(["open", "../elsewhere.md"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      `error: ${path.join(path.dirname(root), "elsewhere.md")} is not a file inside the repository at ${root}\n\n` +
        "next_step: Pass a path to a markdown file inside the repository.\n"
    );
  });

  test("must tell the agent which directory to work from when the doc is in another git repository", async () => {
    const { root, run } = await setUpTest();
    const otherRoot = path.join(path.dirname(root), "other");
    await mkdir(path.join(otherRoot, "docs"), { recursive: true });
    await runCommand("git", ["init", "-q"], { cwd: otherRoot });
    await writeFile(path.join(otherRoot, "docs", "other.md"), "# Other\n");
    running = await runServer({ logger: createMemoryLogger().logger, root: otherRoot });

    const { exitCode, stdout } = await run(["open", "../other/docs/other.md"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      `next_step: This doc belongs to the repository at ${otherRoot}, so run markdown-review commands from that ` +
        "directory. Run `markdown-review poll`"
    );
  });

  test("must use the running server and print the inbox when the agent checks it", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stdout } = await run(["inbox"]);

    expect(exitCode).toBe(0);
    expect(stdout).toBe(`No threads need you.\n\nnext_step: ${waitForCommentsStep}\n`);
  });

  test("must say there are no comments yet when the poll times out", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr, stdout } = await run(["poll", "--timeout", "1"]);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("Waiting up to 1s for review comments.");
    expect(stdout).toBe(
      `No comments yet.\n\nnext_step: Run \`markdown-review poll\` again to keep waiting. ${pollTimeoutAdvice}\n`
    );
  });

  test("must tell the agent to poll again when the server stops while the poll waits", async () => {
    const { start } = await setUpTest({ withServer: true });
    const poll = start(["poll", "--timeout", "20"]);
    await vi.waitFor(() => expect(poll.stderr()).toContain("Waiting up to 20s"));

    await running?.close();

    expect(await poll.exitCode).toBe(1);
    expect(poll.stderr()).toContain(
      "error: The review server stopped while you were waiting\n\nnext_step: Run `markdown-review poll` again; it starts the server again and nothing was lost.\n"
    );
  });

  test("must say no threads need the agent when it resolves a thread that does not exist", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr } = await run(["resolve", "99", "Done"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: No thread #99 is waiting for you. No threads need you.\n\nnext_step: Run `markdown-review inbox` to see them.\n"
    );
  });

  test("must pass on the server's reason when the server refuses the request", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr } = await run(["inbox", "--document", "../outside.md"]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("is not a file inside the repository");
  });
});

interface SetUpOptions {
  inGit?: boolean;
  withServer?: boolean;
}

async function setUpTest({ inGit = true, withServer = false }: SetUpOptions = {}) {
  const root = path.join(await realpath(getDirectory()), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  if (inGit) {
    await runCommand("git", ["init", "-q"], { cwd: root });
  }
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  if (withServer) {
    running = await runServer({ logger: createMemoryLogger().logger, root });
  }
  const start = (args: string[]) => {
    let stdout = "";
    let stderr = "";
    const exitCode = runCli(args, {
      cliPath: path.join(root, "unused-cli.js"),
      terminal: {
        workingDirectory: root,
        env: { MARKDOWN_REVIEW_NO_BROWSER: "1" },
        readStdin: async () => "",
        stderr: (text) => {
          stderr += text;
        },
        stdout: (text) => {
          stdout += text;
        },
      },
    });
    return { exitCode, stderr: () => stderr, stdout: () => stdout };
  };
  const run = async (args: string[]) => {
    const started = start(args);
    const exitCode = await started.exitCode;
    return { exitCode, stderr: started.stderr(), stdout: started.stdout() };
  };
  return { root, run, start };
}
