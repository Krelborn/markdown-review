import { describe, expect, test } from "vitest";

import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import { buildPassageAnchor, buildRound, buildThread, testTime } from "../shared/review/testing/reviewBuilders";
import type { Thread } from "../shared/review/threadSchema";

import { formatInbox } from "./formatInbox";

const roundGoingOn = buildRound();

const roundWentAhead = buildRound({ verdict: { at: "2026-10-08T10:00:00.000Z", kind: "go-ahead" } });

const roundHandedBack = buildRound({ verdict: { at: "2026-10-08T10:00:00.000Z", kind: "hand-back" } });

const cacheThread = buildThread({
  anchor: buildPassageAnchor({
    anchoredText: "cache results for 24h",
    document: "docs/plans/plan.md",
    endLine: 13,
    quote: "cache results for 24h",
    startLine: 12,
  }),
  id: 14,
  messages: [{ at: testTime, author: "user", body: "Why 24h? Upstream data changes hourly." }],
});

const retryThread = buildThread({
  id: 15,
  messages: [{ at: testTime, author: "user", body: "The spec and plan disagree on the retry policy." }],
});

describe("formatInbox", () => {
  test("must group threads by doc and name every ID in next_step when threads need the agent", () => {
    const text = formatInbox(snapshot([retryThread, cacheThread]));

    expect(text).toBe(
      [
        "2 threads need you (docs/plans/plan.md: 1, review: 1)",
        "",
        "#14 docs/plans/plan.md:12-13",
        '  quote: "cache results for 24h"',
        "  user: Why 24h? Upstream data changes hourly.",
        "",
        "#15 (whole review)",
        "  user: The spec and plan disagree on the retry policy.",
        "",
        'next_step: Edit the docs, then run `markdown-review resolve <id> "<what changed>"` for #14 and #15, or ' +
          '`markdown-review reply <id> "<question>"` if you need input. Then run `markdown-review poll` to wait for ' +
          "the next round.",
        "",
      ].join("\n")
    );
  });

  test("must put the notices just before next_step when there are some", () => {
    const text = formatInbox(snapshot([], roundWentAhead), ["update_available: one\n", "skill_outdated: two\n"]);

    expect(text).toBe(
      "The user said go ahead. No threads need you.\n\nupdate_available: one\nskill_outdated: two\n\nnext_step: The " +
        "user said go ahead. Carry on with your task; do not run `markdown-review poll` again for this review.\n"
    );
  });

  test("must tell the agent to carry on when the user said go ahead and nothing needs it", () => {
    expect(formatInbox(snapshot([], roundWentAhead))).toBe(
      [
        "The user said go ahead. No threads need you.",
        "",
        "next_step: The user said go ahead. Carry on with your task; do not run `markdown-review poll` again for this " +
          "review.",
        "",
      ].join("\n")
    );
  });

  test("must ask for the comment to be resolved before carrying on when the user said go ahead with a comment", () => {
    const thread = buildThread({
      anchor: buildPassageAnchor({ document: "docs/plan.md", endLine: 3, startLine: 3 }),
      id: 16,
      messages: [{ at: testTime, author: "user", body: "Make it 12h." }],
    });

    expect(formatInbox(snapshot([thread], roundWentAhead))).toBe(
      [
        "The user said go ahead, 1 thread needs you (docs/plan.md: 1)",
        "",
        "#16 docs/plan.md:3",
        '  quote: "cache results for 24h"',
        "  user: Make it 12h.",
        "",
        "next_step: The user said go ahead, with comments. Address #16 and run " +
          '`markdown-review resolve 16 "<what changed>"`, then carry on with your task; do not run ' +
          "`markdown-review poll` again for this review.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to stop and pass on the comments when the user handed the review back with comments", () => {
    const approachThread = buildThread({
      anchor: buildPassageAnchor({ document: "docs/plan.md", endLine: 3, startLine: 3 }),
      id: 3,
      messages: [{ at: testTime, author: "user", body: "This whole approach is wrong; let's talk." }],
    });
    const retriesThread = buildThread({
      anchor: buildPassageAnchor({
        anchoredText: "Retries happen three times.",
        document: "docs/plan.md",
        endLine: 7,
        quote: "Retries happen three times.",
        startLine: 7,
      }),
      id: 4,
      messages: [{ at: testTime, author: "user", body: "Why three?" }],
    });

    expect(formatInbox(snapshot([approachThread, retriesThread], roundHandedBack))).toBe(
      [
        "The user asked to hand back to you, with comments on 2 threads (docs/plan.md: 2)",
        "",
        "#3 docs/plan.md:3",
        '  quote: "cache results for 24h"',
        "  user: This whole approach is wrong; let's talk.",
        "",
        "#4 docs/plan.md:7",
        '  quote: "Retries happen three times."',
        "  user: Why three?",
        "",
        "next_step: Stop here: do not edit the docs, resolve or reply to #3 and #4, run `markdown-review poll` or " +
          "carry on with your task. Tell the user in the chat that you have stopped and what their comments say, and " +
          "wait for their instructions.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to stop when the user handed the review back and nothing needs it", () => {
    expect(formatInbox(snapshot([], roundHandedBack))).toBe(
      [
        "The user asked to hand back to you. No threads need you.",
        "",
        "next_step: Stop here: do not edit the docs, run `markdown-review poll` or carry on with your task. Tell the " +
          "user in the chat that you have stopped, and wait for their instructions.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to wait for comments when nothing needs it and the round goes on", () => {
    expect(formatInbox(snapshot([]))).toBe(
      "No threads need you.\n\nnext_step: Run `markdown-review poll` to wait for the user's comments. Give the shell " +
        "command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background and `--timeout 7080`.\n"
    );
  });

  test.each<{ condition: string; thread: Thread; expected: string[] }>([
    {
      condition: "a reopened thread has several messages, one of them on two lines",
      thread: buildThread({
        id: 3,
        messages: [
          { at: testTime, author: "user", body: "Why?" },
          { at: testTime, author: "agent", body: "Because of\nthe upstream limit." },
          { at: testTime, author: "user", body: "Not convinced." },
        ],
      }),
      expected: [
        "#3 (whole review)",
        "  user: Why?",
        "  agent: Because of",
        "    the upstream limit.",
        "  user: Not convinced.",
      ],
    },
    {
      condition: "the agent's edit changed the quoted text",
      thread: buildThread({ anchor: buildPassageAnchor({ anchoredText: "cache results for 1h" }), id: 4 }),
      expected: [
        "#4 docs/plan.md:3",
        '  quote: "cache results for 1h"',
        '  was: "cache results for 24h"',
        "  user: Why 24h?",
      ],
    },
    {
      condition: "the passage is outdated",
      thread: buildThread({
        anchor: buildPassageAnchor({ anchoredText: "cache results for 1h", outdated: true }),
        id: 5,
      }),
      expected: ["#5 docs/plan.md:3 (outdated)", '  quote: "cache results for 24h"', "  user: Why 24h?"],
    },
    {
      condition: "the comment is on a whole doc",
      thread: buildThread({ anchor: { document: "docs/x.md", kind: "document" }, id: 6 }),
      expected: ["#6 docs/x.md (whole doc)", "  user: Why 24h?"],
    },
    {
      condition: "the quote is longer than 200 characters",
      thread: buildThread({
        anchor: buildPassageAnchor({
          anchoredText: `${"a".repeat(150)}${"b".repeat(100)}`,
          quote: `${"a".repeat(150)}${"b".repeat(100)}`,
        }),
        id: 7,
      }),
      expected: ["#7 docs/plan.md:3", `  quote: "${"a".repeat(120)}…${"b".repeat(60)}"`, "  user: Why 24h?"],
    },
  ])("must describe the thread compactly when $condition", ({ thread, expected }) => {
    const lines = formatInbox(snapshot([thread])).split("\n");

    expect(lines.slice(2, 2 + expected.length)).toEqual(expected);
  });

  test("must list each unreadable store file as a warning before next_step", () => {
    const text = formatInbox({ ...snapshot([]), problems: ["/repo/.markdown-review/review.json is not valid JSON"] });

    expect(text).toContain("\n\nwarning: /repo/.markdown-review/review.json is not valid JSON\n\nnext_step: ");
  });
});

function snapshot(threads: Thread[], round: ThreadsSnapshot["round"] = roundGoingOn): ThreadsSnapshot {
  return { problems: [], round, threads };
}
