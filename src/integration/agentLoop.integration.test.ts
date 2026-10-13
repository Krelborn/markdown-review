import { describe, expect, test } from "vitest";

import { handedBackStep, pollTimeoutAdvice, waitForCommentsStep, wentAheadStep } from "../cli/nextSteps";
import { threadsSnapshotSchema } from "../shared/api/apiResponseSchemas";

import { plan, setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

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

describe("agent loop", () => {
  test("must hand the user's comment to a waiting poll when the user submits", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const { exitCode, stdout } = await poll.result;
    expect(exitCode).toBe(0);
    expect(stdout).toContain('#1 docs/plan.md:3\n  quote: "cache results for 24h"\n  user: Why 24h?');
  });

  test("must say there are no comments yet and exit cleanly when the poll times out", async () => {
    const repository = getRepository();

    const { exitCode, stdout } = await repository.run(["poll", "--timeout", "1"]);

    expect(exitCode).toBe(0);
    expect(stdout).toBe(
      `No comments yet.\n\nnext_step: Run \`markdown-review poll\` again to keep waiting. ${pollTimeoutAdvice}\n`
    );
  });

  test("must return the same threads when the poll is run again before the agent acts", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const first = await repository.run(["poll", "--timeout", "5"]);
    const second = await repository.run(["poll", "--timeout", "5"]);

    expect(second.stdout).toBe(first.stdout);
    expect(first.stdout).toContain("1 thread needs you (docs/plan.md: 1)");
  });

  test("must tell the agent to run poll again when the poll is killed while waiting", async () => {
    const repository = getRepository();
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    poll.child.kill("SIGTERM");

    const { exitCode, stderr } = await poll.result;
    expect(exitCode).toBe(143);
    expect(stderr).toContain("Nothing was lost; run `markdown-review poll` again");
  });

  test.each([
    { verdict: "go-ahead", expected: `The user said go ahead. No threads need you.\n\nnext_step: ${wentAheadStep}\n` },
    {
      verdict: "hand-back",
      expected: `The user asked to hand back to you. No threads need you.\n\nnext_step: ${handedBackStep}\n`,
    },
  ])(
    "must end the poll when the user chooses $verdict, and start a new round on the next open",
    async ({ verdict, expected }) => {
      const repository = getRepository();
      await repository.run(["open", "docs/plan.md"]);
      const poll = repository.start(["poll", "--timeout", "20"]);
      await poll.printedToStderr("Waiting up to 20s");

      await repository.browser("POST", "/api/submit", { verdict });
      const ended = await poll.result;
      await repository.run(["open", "docs/plan.md"]);
      const nextRound = await repository.run(["inbox"]);

      expect(ended.stdout).toBe(expected);
      expect(nextRound.stdout).toBe(`No threads need you.\n\nnext_step: ${waitForCommentsStep}\n`);
    }
  );

  test("must pass the comments on when the user hands the review back with them", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "hand-back" });

    const { stdout } = await poll.result;
    expect(stdout).toContain("The user asked to hand back to you, with comments on 1 thread (docs/plan.md: 1)");
    expect(stdout).toContain("next_step: Stop here: do not edit the docs, resolve or reply to #1,");
  });

  test("must show the browser the agent's next task when the agent opens a doc with one", async () => {
    const repository = getRepository();

    await repository.run(["open", "docs/plan.md", "--next-task", "implement the plan in src/server"]);

    const snapshot = threadsSnapshotSchema.parse(await (await repository.browser("GET", "/api/threads?all=1")).json());
    expect(snapshot.round?.nextTask).toBe("implement the plan in src/server");
  });

  test("must say what is left after each reply and resolve", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const replied = await repository.run(["reply", "1", "Upstream", "is", "daily."]);
    const resolved = await repository.run(["resolve", "2", "--file", "-"], "Checked every section.\nAll consistent.");

    expect(replied.stdout).toContain("Replied to #1; it waits for the user.\n1 thread still needs you: #2.");
    expect(resolved.stdout).toContain("Resolved #2. No threads need you now.");
  });

  test("must name the threads that need the agent when it acts on a thread that does not", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const { exitCode, stderr } = await repository.run(["resolve", "99"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: No thread #99 is waiting for you. The threads that need you are #1.\n\nnext_step: Run `markdown-review inbox` to see them.\n"
    );
  });

  test("must report the moved lines when the doc was edited while the server was stopped", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "revise" });
    await repository.run(["stop"]);

    await repository.writeDocument("docs/plan.md", plan.replace("# Plan\n\n", "# Plan\n\nIntro.\n\n"));
    const { stdout } = await repository.run(["inbox"]);

    expect(stdout).toContain("#1 docs/plan.md:5\n");
  });
});
