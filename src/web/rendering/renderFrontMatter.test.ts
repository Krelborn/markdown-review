import { describe, expect, test } from "vitest";

import { renderDocument } from "./renderDocument";

const frontMatter = [
  "---",
  "title: Payment retries",
  "draft: true",
  "version: 3",
  "created: 2026-10-01",
  "spec: https://example.com/spec",
  "tags: [payments, reliability]",
  "reviewers:",
  "  - alice",
  "  - bob",
  "owner:",
  "  name: Matt",
  "notes:",
  "---",
  "",
  "# Plan",
  "",
].join("\n");

describe("renderFrontMatter", () => {
  test("must show the frontmatter as an open Properties panel in the frontmatter's block when the doc starts with frontmatter", async () => {
    const page = await renderPage(frontMatter);

    const block = page.querySelector('[data-md-block="0"]');
    expect(block?.getAttribute("data-md-start")).toBe("1");
    expect(block?.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(block?.querySelector("summary")?.textContent).toBe("Properties");
    expect(block?.querySelector(":scope > pre")).toBeNull();
  });

  test("must list each key in order, with the kind of value it has, when the frontmatter is a mapping", async () => {
    const page = await renderPage(frontMatter);

    expect(elements.keys(page)).toEqual([
      ["text", "title"],
      ["checkbox", "draft"],
      ["number", "version"],
      ["date", "created"],
      ["link", "spec"],
      ["tags", "tags"],
      ["list", "reviewers"],
      ["nested", "owner"],
      ["empty", "notes"],
    ]);
  });

  test.each([
    { expected: "Payment retries", key: "title" },
    { expected: "3", key: "version" },
    { expected: "2026-10-01", key: "created" },
    { expected: "name: Matt", key: "owner" },
    { expected: "Empty", key: "notes" },
  ])("must show the $key value as $expected when the frontmatter sets $key", async ({ expected, key }) => {
    const page = await renderPage(frontMatter);

    expect(elements.value(page, key)?.textContent).toBe(expected);
  });

  test("must show a list as chips, and tags as tag chips, when the frontmatter has lists", async () => {
    const page = await renderPage(frontMatter);

    expect(elements.chips(page, "tags")).toEqual([
      ["payments", true],
      ["reliability", true],
    ]);
    expect(elements.chips(page, "reviewers")).toEqual([
      ["alice", false],
      ["bob", false],
    ]);
  });

  test("must show a ticked checkbox that cannot be changed when a value is true", async () => {
    const page = await renderPage(frontMatter);

    const checkbox = elements.value(page, "draft")?.querySelector("input");
    expect(checkbox?.getAttribute("type")).toBe("checkbox");
    expect(checkbox?.hasAttribute("checked")).toBe(true);
    expect(checkbox?.hasAttribute("disabled")).toBe(true);
  });

  test("must show a link that opens in a new tab when a value is a web address", async () => {
    const page = await renderPage(frontMatter);

    const link = elements.value(page, "spec")?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com/spec");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  test("must show the markup as text when a value holds markup", async () => {
    const page = await renderPage('---\ntitle: "<img src=x onerror=alert(1)>"\n---\n');

    expect(elements.value(page, "title")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(page.querySelector("img")).toBeNull();
  });

  test.each([
    { condition: "has a YAML error", yaml: "title: [unclosed" },
    { condition: "is a list rather than a mapping", yaml: "- a\n- b" },
    { condition: "uses an alias that has no anchor", yaml: "title: *draft" },
  ])("must keep the frontmatter as code headed frontmatter when it $condition", async ({ yaml }) => {
    const page = await renderPage(`---\n${yaml}\n---\n`);

    const block = page.querySelector('[data-md-block="0"]');
    expect(block?.getAttribute("data-language")).toBe("frontmatter");
    expect(block?.querySelector("pre")?.textContent).toBe(yaml);
  });

  test("must say there are no properties when the frontmatter is empty", async () => {
    const page = await renderPage("---\n---\n\n# Plan\n");

    expect(page.querySelector('[data-md-block="0"] details')?.textContent).toBe("PropertiesNo properties");
  });

  test("must leave the doc's HTML as it is when the HTML marks an element as frontmatter", async () => {
    const page = await renderPage("Read <span data-front-matter>title: Plan</span> first.\n");

    expect(page.querySelector("details")).toBeNull();
    expect(page.querySelector('[data-md-block="0"]')?.textContent).toBe("Read title: Plan first.");
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plan.md");
  return page;
}

const elements = {
  chips: (page: HTMLElement, key: string): [string, boolean][] =>
    [...(elements.value(page, key)?.querySelectorAll("[data-chip]") ?? [])].map((chip) => [
      chip.textContent,
      chip.hasAttribute("data-tag"),
    ]),
  keys: (page: HTMLElement): string[][] =>
    [...page.querySelectorAll("dt")].map((term) => [term.getAttribute("data-type") ?? "", term.textContent]),
  value: (page: HTMLElement, key: string): Element | null =>
    [...page.querySelectorAll("dt")].find((term) => term.textContent === key)?.nextElementSibling ?? null,
};
