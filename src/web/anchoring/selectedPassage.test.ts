import { describe, expect, test } from "vitest";

import { mountDocument } from "../testing/mountDocument";

import type { PagePoint } from "./PagePoint";
import { selectedPassage } from "./selectedPassage";

const source = [
  "# Plan",
  "",
  "We cache results for **24h** today.",
  "",
  "Retries happen three times.",
  "",
  "| Setting | Value |",
  "| --- | --- |",
  "| ttl | `3600` |",
  "",
  "<div>",
  "Raw HTML",
  "</div>",
  "",
].join("\n");

describe("selectedPassage", () => {
  test("must anchor to the canonical text the user selected when the selection crosses inline markup", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("cache"), pointAt("24h", true))
    );

    expect(anchor).toEqual({
      document: "docs/plan.md",
      endOffset: 29,
      kind: "passage",
      prefix: "Plan\nWe ",
      quote: "cache results for 24h",
      startOffset: 8,
      suffix: " today.\nRetries happen three tim",
    });
  });

  test("must join the blocks' text with a line break when the selection spans two paragraphs", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("24h"), pointAt("Retries", true))
    );

    expect(anchor?.quote).toBe("24h today.\nRetries");
  });

  test("must leave out the line break after a paragraph when the user selects the whole paragraph", async () => {
    const { container, documentText } = await mountDocument(source);
    const paragraph = container.querySelector('[data-md-block="1"]') ?? container;
    const nextParagraph = container.querySelector('[data-md-block="2"]') ?? container;

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select({ node: paragraph, offset: 0 }, { node: nextParagraph, offset: 0 })
    );

    expect(anchor?.quote).toBe("We cache results for 24h today.");
  });

  test("must start at the next block when the selection starts between blocks", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const between = container.querySelector("h1")?.nextSibling ?? container;

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select({ node: between, offset: 0 }, pointAt("We", true))
    );

    expect(anchor?.quote).toBe("We");
  });

  test("must separate the cells with a tab when the selection spans a table row", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("ttl"), pointAt("3600", true))
    );

    expect(anchor?.quote).toBe("ttl\t3600");
  });

  test("must take in the whole block when the selection ends inside a block that takes whole-block comments only", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("3600"), pointAt("Raw", true))
    );

    expect(anchor?.quote).toBe("3600\n<div>\nRaw HTML\n</div>");
  });

  test("must not count the app's own controls when a block holds one", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const marker = document.createElement("button");
    marker.setAttribute("data-md-ignore", "");
    marker.textContent = "#1";
    container.querySelector("p")?.prepend(marker);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("cache"), pointAt("cache", true))
    );

    expect(anchor).toMatchObject({ endOffset: 13, quote: "cache", startOffset: 8 });
  });

  test.each([
    { condition: "nothing is selected", start: "cache", end: "cache" },
    { condition: "only the space between two words is selected", start: " results", end: "results" },
  ])("must give no anchor when $condition", async ({ end, start }) => {
    const { container, documentText, pointAt } = await mountDocument(source);

    expect(selectedPassage(container, documentText, "docs/plan.md", select(pointAt(start), pointAt(end)))).toBeNull();
  });
});

function select(start: PagePoint, end: PagePoint): Range {
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
