import { existsSync } from "node:fs";
import { rm, symlink } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { plan, setUpReviewRepository } from "./testing/setUpReviewRepository";

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
      expect(stderr).toMatch(/^error: docs\/nope\.md does not exist.*\n\nnext_step: Check the path/);
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
});
