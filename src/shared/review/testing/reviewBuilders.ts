import type { PassageAnchor } from "../anchorSchema";
import type { Thread } from "../threadSchema";

export const testTime = "2026-10-08T09:00:00.000Z";

export function buildPassageAnchor(overrides: Partial<PassageAnchor> = {}): PassageAnchor {
  return {
    anchoredText: "cache results for 24h",
    document: "docs/plan.md",
    endLine: 3,
    endOffset: 26,
    kind: "passage",
    outdated: false,
    prefix: "Plan\n",
    quote: "cache results for 24h",
    startLine: 3,
    startOffset: 5,
    suffix: "",
    ...overrides,
  };
}

export function buildThread(overrides: Partial<Thread> = {}): Thread {
  return {
    anchor: { kind: "review" },
    createdAt: testTime,
    id: 1,
    messages: [{ at: testTime, author: "user", body: "Why 24h?" }],
    status: "open",
    updatedAt: testTime,
    ...overrides,
  };
}
