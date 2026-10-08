import { describe, expect, test } from "vitest";

import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import { buildPassageAnchor, buildThread, testTime } from "../shared/review/testing/reviewBuilders";
import type { Thread } from "../shared/review/threadSchema";

import { formatInbox } from "./formatInbox";

const notApproved = { approved: false, approvedAt: null, requestedAt: testTime };

const approved = { approved: true, approvedAt: "2026-10-08T10:00:00.000Z", requestedAt: testTime };

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

  test("must tell the agent to carry on when the review is approved and nothing needs it", () => {
    expect(formatInbox(snapshot([], approved))).toBe(
      "Review approved. No threads need you.\n\nnext_step: The user approved the review. Carry on with your task; " +
        "do not run `markdown-review poll` again for this review.\n"
    );
  });

  test("must ask for the comment to be resolved before carrying on when the review is approved with a comment", () => {
    const thread = buildThread({
      anchor: buildPassageAnchor({
        anchoredText: "retry three times",
        document: "docs/plans/plan.md",
        endLine: 40,
        quote: "retry three times",
        startLine: 40,
      }),
      id: 16,
      messages: [{ at: testTime, author: "user", body: "Nit: make the retry count configurable." }],
    });

    expect(formatInbox(snapshot([thread], approved))).toBe(
      [
        "Review approved, 1 thread needs you (docs/plans/plan.md: 1)",
        "",
        "#16 docs/plans/plan.md:40",
        '  quote: "retry three times"',
        "  user: Nit: make the retry count configurable.",
        "",
        "next_step: The user approved the review with comments. Address #16 and run " +
          '`markdown-review resolve 16 "<what changed>"`, then carry on with your task; do not run ' +
          "`markdown-review poll` again for this review.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to wait for comments when nothing needs it and the review is not approved", () => {
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

function snapshot(threads: Thread[], review: ThreadsSnapshot["review"] = notApproved): ThreadsSnapshot {
  return { problems: [], review, threads };
}
