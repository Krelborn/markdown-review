import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../review/testing/reviewBuilders";

import type {
  AgentOpenResponse,
  AgentThreadResponse,
  DocumentList,
  DocumentSource,
  Health,
  PollResponse,
  ShutdownResponse,
  ThreadsSnapshot,
} from "./apiResponseSchemas";
import {
  agentOpenResponseSchema,
  agentThreadResponseSchema,
  apiErrorSchema,
  documentListSchema,
  documentSourceSchema,
  healthSchema,
  pollResponseSchema,
  shutdownResponseSchema,
  threadsSnapshotSchema,
} from "./apiResponseSchemas";

const review = { approved: false, approvedAt: null, requestedAt: testTime };

const inbox: ThreadsSnapshot = { problems: [], review, threads: [buildThread()] };

describe("apiResponseSchemas", () => {
  test("must accept each response the server sends when it has the documented shape", () => {
    const health: Health = { name: "markdown-review", pid: 42, protocol: 1, root: "/repo", version: "0.1.0" };
    const poll: PollResponse = { ...inbox, timedOut: false };
    const opened: AgentOpenResponse = { navigated: false, review, url: "http://127.0.0.1:50000/" };
    const acted: AgentThreadResponse = { inbox, thread: buildThread() };
    const stopping: ShutdownResponse = { stopping: true };
    const documents: DocumentList = {
      documents: [{ document: "docs/plan.md", draftCount: 1, openCount: 2 }],
      problems: [],
      recent: ["docs/spec.md"],
    };
    const source: DocumentSource = { hash: "a".repeat(64), path: "docs/plan.md", source: "# Plan\n" };

    expect(healthSchema.parse(health)).toEqual(health);
    expect(threadsSnapshotSchema.parse(inbox)).toEqual(inbox);
    expect(pollResponseSchema.parse(poll)).toEqual(poll);
    expect(agentOpenResponseSchema.parse(opened)).toEqual(opened);
    expect(agentThreadResponseSchema.parse(acted)).toEqual(acted);
    expect(shutdownResponseSchema.parse(stopping)).toEqual(stopping);
    expect(documentListSchema.parse(documents)).toEqual(documents);
    expect(documentSourceSchema.parse(source)).toEqual(source);
  });

  test("must recognise an error response when the server refuses a request", () => {
    expect(apiErrorSchema.safeParse({ error: { message: "No thread #9", reason: "unknown-thread" } }).success).toBe(
      true
    );
  });
});
