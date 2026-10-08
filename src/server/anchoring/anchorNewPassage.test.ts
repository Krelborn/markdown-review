import { describe, expect, test } from "vitest";

import { hashSource } from "../store/hashSource";

import { anchorNewPassage } from "./anchorNewPassage";

const rendered = "# Plan\n\nWe cache results for 24h.\n";

const selection = {
  document: "docs/plan.md",
  endOffset: 29,
  kind: "passage" as const,
  prefix: "Plan\nWe ",
  quote: "cache results for 24h",
  startOffset: 8,
  suffix: ".",
};

describe("anchorNewPassage", () => {
  test("must anchor at the selected offsets when the browser rendered the current source", () => {
    expect(anchorNewPassage(selection, rendered, hashSource(rendered))).toEqual({
      ...selection,
      anchoredText: "cache results for 24h",
      endLine: 3,
      outdated: false,
      startLine: 3,
    });
  });

  test("must re-anchor against the current source when the doc changed after the browser rendered it", () => {
    const current = "# Plan\n\nIntro.\n\nWe cache results for 24h.\n";

    const anchor = anchorNewPassage(selection, current, hashSource(rendered));

    expect(anchor).toMatchObject({ endOffset: 36, outdated: false, startLine: 5, startOffset: 15 });
  });
});
