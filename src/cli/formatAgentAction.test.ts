import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../shared/review/testing/reviewBuilders";

import { formatAgentAction } from "./formatAgentAction";

const notApproved = { approved: false, approvedAt: null, requestedAt: testTime };

describe("formatAgentAction", () => {
  test("must confirm the reply and list the threads still waiting when others need the agent", () => {
    const text = formatAgentAction("replied", {
      inbox: { problems: [], review: notApproved, threads: [buildThread({ id: 15 }), buildThread({ id: 16 })] },
      thread: buildThread({ id: 14 }),
    });

    expect(text).toBe(
      "Replied to #14; it waits for the user.\n2 threads still need you: #15 and #16.\n\nnext_step: Address #15 and #16, " +
        'then run `markdown-review resolve <id> "<what changed>"`, or `markdown-review reply <id> "<question>"` if you need input.\n'
    );
  });

  test("must tell the agent to wait for the next round when it resolved the last thread", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], review: notApproved, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toBe(
      "Resolved #14. No threads need you now.\n\nnext_step: Run `markdown-review poll` to wait for the user's next round of comments.\n"
    );
  });

  test("must tell the agent to carry on when it resolved the last thread of an approved review", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], review: { ...notApproved, approved: true, approvedAt: testTime }, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toContain("next_step: The user approved the review. Carry on with your task;");
  });
});
