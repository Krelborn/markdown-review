import { describe, expect, test } from "vitest";

import { buildRound, buildThread, testTime } from "../shared/review/testing/reviewBuilders";

import { formatAgentAction } from "./formatAgentAction";

const roundGoingOn = buildRound();

const roundHandedBack = buildRound({ verdict: { at: testTime, kind: "hand-back" } });

describe("formatAgentAction", () => {
  test("must confirm the reply and list the threads still waiting when others need the agent", () => {
    const text = formatAgentAction("replied", {
      inbox: { problems: [], round: roundGoingOn, threads: [buildThread({ id: 15 }), buildThread({ id: 16 })] },
      thread: buildThread({ id: 14 }),
    });

    expect(text).toBe(
      "Replied to #14; it waits for the user.\n2 threads still need you: #15 and #16.\n\nnext_step: Address #15 and #16, " +
        'then run `markdown-review resolve <id> "<what changed>"`, or `markdown-review reply <id> "<question>"` if you need input.\n'
    );
  });

  test("must tell the agent to wait for the next round when it resolved the last thread", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], round: roundGoingOn, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toBe(
      "Resolved #14. No threads need you now.\n\nnext_step: Run `markdown-review poll` to wait for the user's next round of comments.\n"
    );
  });

  test("must tell the agent to carry on when it resolved the last thread after the user said go ahead", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], round: { ...roundGoingOn, verdict: { at: testTime, kind: "go-ahead" } }, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toContain("next_step: The user said go ahead. Carry on with your task;");
  });

  test("must tell the agent to address the threads left when the user said go ahead with comments", () => {
    const text = formatAgentAction("resolved", {
      inbox: {
        problems: [],
        round: { ...roundGoingOn, verdict: { at: testTime, kind: "go-ahead" } },
        threads: [buildThread({ id: 5 })],
      },
      thread: buildThread({ id: 4, status: "resolved" }),
    });

    expect(text).toContain('next_step: Address #5, then run `markdown-review resolve <id> "<what changed>"`');
  });

  test("must tell the agent to act only as the user asks when threads are left after a hand-back", () => {
    const text = formatAgentAction("replied", {
      inbox: { problems: [], round: roundHandedBack, threads: [buildThread({ id: 4 })] },
      thread: buildThread({ id: 3 }),
    });

    expect(text).toBe(
      "Replied to #3; it waits for the user.\n1 thread still needs you: #4.\n\nnext_step: The user handed the review " +
        "back, so act on #4 only as they ask in the chat.\n"
    );
  });

  test("must tell the agent to report back and wait when it resolved the last thread after a hand-back", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], round: roundHandedBack, threads: [] },
      thread: buildThread({ id: 4, status: "resolved" }),
    });

    expect(text).toBe(
      "Resolved #4. No threads need you now.\n\nnext_step: The user handed the review back. Tell them what you " +
        "changed and wait for their instructions; run `markdown-review open <path>` and `markdown-review poll` only " +
        "if they ask you to continue the review.\n"
    );
  });
});
