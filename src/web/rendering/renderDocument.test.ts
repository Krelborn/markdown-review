import { describe, expect, test } from "vitest";

import { renderDocument } from "./renderDocument";

describe("renderDocument", () => {
  test("must highlight fenced code when the doc names a language Shiki knows", async () => {
    const page = await renderPage("```TS\nconst ttl = 3600;\n```\n");

    expect(page.querySelector('[data-md-block="0"] > pre.shiki')?.textContent).toBe("const ttl = 3600;");
  });

  test.each(["mermaid", "not-a-language"])(
    "must leave the code plain when the fence's language is %s",
    async (language) => {
      const page = await renderPage(`\`\`\`${language}\ngraph TD\n\`\`\`\n`);

      expect(page.querySelector('[data-md-block="0"] > pre > code')?.className).toBe(`language-${language}`);
    }
  );

  test.each([
    { condition: "names a language Shiki knows", expected: "TS", fence: "```TS\nconst ttl = 3600;\n```\n" },
    {
      condition: "names a language Shiki does not know",
      expected: "not-a-language",
      fence: "```not-a-language\nx\n```\n",
    },
    { condition: "names no language", expected: null, fence: "```\nx\n```\n" },
    { condition: "holds a Mermaid diagram", expected: null, fence: "```mermaid\ngraph TD\n```\n" },
    { condition: "names a language holding markup", expected: '"><b>x', fence: '```"><b>x\ny\n```\n' },
  ])("must give the fence's language to its header when the fence $condition", async ({ expected, fence }) => {
    const page = await renderPage(fence);

    expect(page.querySelector('[data-md-block="0"]')?.getAttribute("data-language")).toBe(expected);
    expect(page.querySelector("b")).toBeNull();
  });

  test.each([
    {
      condition: "another doc",
      markdown: "[Spec](../spec.md#goals)",
      href: "/document/docs/spec.md#goals",
      target: null,
    },
    {
      condition: "a doc from the repo root",
      markdown: "[Readme](/README.md)",
      href: "/document/README.md",
      target: null,
    },
    {
      condition: "another file",
      markdown: "[Report](<data/Q3 report.csv>)",
      href: "/files/docs/plans/data/Q3%20report.csv",
      target: "_blank",
    },
    {
      condition: "another site",
      markdown: "[Site](https://example.com/a)",
      href: "https://example.com/a",
      target: "_blank",
    },
    { condition: "a heading in the doc", markdown: "[Goals](#goals)", href: "#goals", target: null },
  ])("must point the link at the right page when it goes to $condition", async ({ href, markdown, target }) => {
    const page = await renderPage(markdown);

    const link = page.querySelector("a");
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.getAttribute("target")).toBe(target);
  });

  test("must load an image from the repo's files when the doc gives a relative path", async () => {
    const page = await renderPage("![Flow](<Flow Chart.png>)");

    expect(page.querySelector("img")?.getAttribute("src")).toBe("/files/docs/plans/Flow%20Chart.png");
  });

  test("must give headings GitHub's ids when the doc has headings, including repeated ones", async () => {
    const page = await renderPage("# Retry Policy (v2)\n\n## Notes\n\n## Notes\n");

    expect([...page.querySelectorAll("h1, h2")].map((heading) => heading.id)).toEqual([
      "retry-policy-v2",
      "notes",
      "notes-1",
    ]);
  });

  test("must give each heading a link to itself that the walk of its text skips when the doc has headings", async () => {
    const page = await renderPage("# Retry Policy\n\n## Notes\n");

    const links = [...page.querySelectorAll("h1 > a, h2 > a")].map((link) => [
      link.getAttribute("href"),
      link.getAttribute("aria-label"),
      link.hasAttribute("data-md-ignore"),
    ]);
    expect(links).toEqual([
      ["#retry-policy", "Link to Retry Policy", true],
      ["#notes", "Link to Notes", true],
    ]);
  });

  test.each([
    { marker: "NOTE", title: "Note" },
    { marker: "tip", title: "Tip" },
    { marker: "Important", title: "Important" },
    { marker: "WARNING", title: "Warning" },
    { marker: "CAUTION", title: "Caution" },
  ])(
    "must title a $marker alert $title, apart from the walk of the doc's text, when the doc has one",
    async ({ marker, title }) => {
      const page = await renderPage(`> [!${marker}]\n> Read this.\n`);

      const alertTitle = page.querySelector(".markdown-alert > .markdown-alert-title");
      expect(alertTitle?.textContent).toBe(title);
      expect(alertTitle?.hasAttribute("data-md-ignore")).toBe(true);
      expect(page.querySelector('[data-md-block="0"]')?.textContent).toBe("Read this.");
    }
  );

  test("must put each table and code block in the tab order when the doc has tables and code", async () => {
    const page = await renderPage("| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst a = 1;\n```\n\n    indented code\n");

    expect([...page.querySelectorAll<HTMLElement>("table, pre")].map((block) => block.tabIndex)).toEqual([0, 0, 0]);
  });

  test.each([
    { source: "## Steps <pre>npm test</pre>\n", where: "a heading" },
    { source: "- Run <pre>npm test</pre>\n", where: "a tight list item" },
  ])("must leave a pre out of the tab order when the doc writes it inline in $where", async ({ source }) => {
    const page = await renderPage(source);

    expect([...page.querySelectorAll<HTMLElement>("pre")].map((pre) => pre.tabIndex)).toEqual([-1]);
  });

  test("must name a heading by its text alone when it has a link", async () => {
    const page = await renderPage("# Retry `Policy`\n");

    expect(page.querySelector("h1")?.getAttribute("aria-label")).toBe("Retry Policy");
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plans/plan.md");
  return page;
}
