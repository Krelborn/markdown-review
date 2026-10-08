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
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plans/plan.md");
  return page;
}
