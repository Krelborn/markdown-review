import { describe, expect, test } from "vitest";

import type { Anchor } from "./anchorSchema";
import type { DocumentThreadsFile } from "./documentThreadsFileSchema";
import { documentThreadsFileSchema } from "./documentThreadsFileSchema";
import { buildPassageAnchor, buildThread } from "./testing/reviewBuilders";

const sourceHash = "a".repeat(64);

describe("documentThreadsFileSchema", () => {
  test("must accept the file when every thread is anchored to its doc", () => {
    const file: DocumentThreadsFile = {
      document: "docs/plan.md",
      sourceHash,
      threads: [buildThread({ anchor: buildPassageAnchor() })],
      version: 1,
    };

    expect(documentThreadsFileSchema.safeParse(file).success).toBe(true);
  });

  test("must accept the file when the doc was missing at the last check", () => {
    const file: DocumentThreadsFile = { document: "docs/plan.md", sourceHash: null, threads: [], version: 1 };

    expect(documentThreadsFileSchema.safeParse(file).success).toBe(true);
  });

  test.each<{ condition: string; anchor: Anchor }>([
    { condition: "a thread is on the whole review", anchor: { kind: "review" } },
    { condition: "a thread is anchored to another doc", anchor: buildPassageAnchor({ document: "docs/other.md" }) },
  ])("must reject the file when $condition", ({ anchor }) => {
    const file: DocumentThreadsFile = {
      document: "docs/plan.md",
      sourceHash,
      threads: [buildThread({ anchor })],
      version: 1,
    };

    expect(documentThreadsFileSchema.safeParse(file).success).toBe(false);
  });
});
