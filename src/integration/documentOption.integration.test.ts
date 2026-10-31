import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { wentAheadStep } from "../cli/nextSteps";

import { createGitRepository } from "./testing/createGitRepository";
import { plan, setUpReviewRepository } from "./testing/setUpReviewRepository";
import { startCli } from "./testing/startCli";
import { stopReviewServer } from "./testing/stopReviewServer";

const getRepository = setUpReviewRepository();

const isCaseInsensitive = existsSync(import.meta.filename.toUpperCase());

const cacheComment = {
  anchor: {
    document: "docs/plan.md",
    endOffset: 29,
    kind: "passage",
    prefix: "Plan\nWe ",
    quote: "cache results for 24h",
    startOffset: 8,
    suffix: ".\nRetries happen three times.",
  },
  body: "Why 24h?",
};

describe("--document", () => {
  test.each([{ command: "inbox" }, { command: "poll" }])(
    "must fail straight away and say the doc does not exist when $command is given a path that is not a doc",
    async ({ command }) => {
      const repository = getRepository();
      await repository.run(["open", "docs/plan.md"]);

      const { exitCode, stderr, stdout } = await repository.run([command, "--document", "docs/nope.md"]);

      expect(exitCode).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toMatch(/(^|\n)error: docs\/nope\.md does not exist.*\n\nnext_step: Check the path/);
    }
  );

  test.each([
    { command: ["inbox"], document: "docs/plan.md" },
    { command: ["poll", "--timeout", "5"], document: "docs/plan.md" },
    { command: ["inbox"], document: "./docs/../docs/plan.md" },
  ])("must hand over the doc's threads when $command is given $document", async ({ command, document }) => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const { exitCode, stdout } = await repository.run([...command, "--document", document]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('#1 docs/plan.md:3\n  quote: "cache results for 24h"\n  user: Why 24h?');
  });

  test.each([{ command: ["inbox"] }, { command: ["poll", "--timeout", "5"] }])(
    "must find the doc's threads when $command is given a symbolic link to the doc",
    async ({ command }) => {
      const repository = getRepository();
      await symlink(path.join(repository.root, "docs", "plan.md"), path.join(repository.root, "link.md"));
      await repository.run(["open", "docs/plan.md"]);
      await repository.browser("POST", "/api/threads", cacheComment);
      await repository.browser("POST", "/api/submit", { verdict: "revise" });

      const { exitCode, stdout } = await repository.run([...command, "--document", "link.md"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("#1 docs/plan.md:3");
    }
  );

  test.skipIf(!isCaseInsensitive)(
    "must find the doc's threads when inbox is given the path in another case",
    async () => {
      const repository = getRepository();
      await repository.run(["open", "docs/plan.md"]);
      await repository.browser("POST", "/api/threads", cacheComment);
      await repository.browser("POST", "/api/submit", { verdict: "revise" });

      const { stdout } = await repository.run(["inbox", "--document", "DOCS/Plan.MD"]);

      expect(stdout).toContain("#1 docs/plan.md:3");
    }
  );

  test.each([{ command: ["inbox"] }, { command: ["poll", "--timeout", "5"] }])(
    "must still hand over the threads when $command is given a doc that was deleted during the review",
    async ({ command }) => {
      const repository = getRepository();
      await repository.run(["open", "docs/plan.md"]);
      await repository.browser("POST", "/api/threads", cacheComment);
      await repository.browser("POST", "/api/submit", { verdict: "revise" });
      await rm(path.join(repository.root, "docs", "plan.md"));

      const { exitCode, stdout } = await repository.run([...command, "--document", "docs/plan.md"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("#1 docs/plan.md");
    }
  );

  test("must only hand over the threads on the doc it is given", async () => {
    const repository = getRepository();
    await repository.writeDocument("docs/other.md", plan);
    await repository.run(["open", "docs/plan.md"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const { stdout } = await repository.run(["inbox", "--document", "docs/other.md"]);

    expect(stdout).not.toContain("#1");
  });

  test("must find the threads when the path goes through a link to a folder and the doc was deleted", async () => {
    const repository = getRepository();
    await symlink(path.join(repository.root, "docs"), path.join(repository.root, "linked"));
    await repository.run(["open", "linked/plan.md"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });
    await rm(path.join(repository.root, "docs", "plan.md"));

    const { exitCode, stdout } = await repository.run(["inbox", "--document", "linked/plan.md"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("#1 docs/plan.md");
  });

  test("must return the verdict when poll is given a deleted doc whose threads were all resolved", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });
    await rm(path.join(repository.root, "docs", "plan.md"));
    await repository.run(["resolve", "1", "Dropped the doc."]);
    await repository.browser("POST", "/api/submit", { verdict: "go-ahead" });

    const { exitCode, stdout } = await repository.run(["poll", "--timeout", "5", "--document", "docs/plan.md"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(`The user said go ahead. No threads need you.\n\nnext_step: ${wentAheadStep}`);
  });

  test("must find the threads when the doc is named by a link outside the repository, run from a folder in it", async () => {
    const repository = getRepository();
    const links = await realpath(await mkdtemp(path.join(os.tmpdir(), "markdown-review-links-")));
    try {
      await symlink(path.join(repository.root, "docs", "plan.md"), path.join(links, "plan.md"));
      await repository.run(["open", "docs/plan.md"]);
      await repository.browser("POST", "/api/threads", cacheComment);
      await repository.browser("POST", "/api/submit", { verdict: "revise" });

      const { exitCode, stdout } = await startCli(path.join(repository.root, "docs"), [
        "inbox",
        "--document",
        path.join(links, "plan.md"),
      ]).result;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("#1 docs/plan.md:3");
    } finally {
      await rm(links, { force: true, recursive: true });
    }
  });

  test("must open the doc in the repository a link leads to when open is given a link to another repository", async () => {
    const repository = getRepository();
    const other = await createGitRepository({ "docs/notes.md": "# Notes\n" });
    try {
      await symlink(path.join(other, "docs", "notes.md"), path.join(repository.root, "notes.md"));

      const { exitCode, stdout } = await repository.run(["open", "notes.md"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Opened docs/notes.md for review");
      expect(stdout).toContain(`so run markdown-review commands from that directory`);
      expect(stdout).toContain(other);
    } finally {
      await stopReviewServer(other);
      await rm(other, { force: true, recursive: true });
    }
  });

  test.each([
    { command: ["inbox"], target: "docs" },
    { command: ["poll", "--timeout", "5"], target: "docs" },
    { command: ["inbox"], target: "." },
  ])("must fail with a CliError when $command is given the directory $target", async ({ command, target }) => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);

    const { exitCode, stderr } = await repository.run([...command, "--document", target]);

    expect(exitCode).toBe(1);
    expect(stderr).toMatch(
      new RegExp(`(^|\\n)error: ${target.replace(".", "\\.")} is not a file\\n\\nnext_step: Pass the path`)
    );
  });

  test("must return the verdict for a doc deleted after it was opened, before any comment was made", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    await rm(path.join(repository.root, "docs", "plan.md"));
    await repository.browser("POST", "/api/submit", { verdict: "go-ahead" });

    const { exitCode, stdout } = await repository.run(["poll", "--timeout", "5", "--document", "docs/plan.md"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("The user said go ahead.");
  });

  test.each([
    { target: "." },
    { target: ".." },
    { target: "docs" },
    { target: "../missing.md" },
    { target: "missing.md" },
  ])("must say $target is not a file when open is given it", async ({ target }) => {
    const repository = getRepository();

    const { exitCode, stderr } = await repository.run(["open", target]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      `error: ${target} is not a file\n\nnext_step: Check the path and run \`markdown-review open <path>\` again.\n`
    );
  });
});
