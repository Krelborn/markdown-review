import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderDocument } from "./renderDocument";
import { hasMermaidDiagrams, renderMermaidDiagrams } from "./renderMermaidDiagrams";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), parse: vi.fn(), render: vi.fn() }));

vi.mock("mermaid", () => ({ default: mermaid }));

const diagramSource = "```mermaid\ngraph TD\n  A-->B\n```\n";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow"><text>A</text></svg>' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMermaidDiagrams", () => {
  test("must draw the diagram in its block in place of its source when the doc has a Mermaid fence", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > svg')?.getAttribute("aria-label")).toBe("Request flow");
    expect(page.querySelector("pre")).toBeNull();
  });

  test("must keep showing the source when Mermaid cannot read the diagram", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue(false);

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > pre')?.textContent).toBe("graph TD\n  A-->B");
  });

  test("must draw a drawn diagram again from its definition when the diagrams are drawn again", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    await renderMermaidDiagrams(page);
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > svg')?.getAttribute("aria-label")).toBe(
      "Request flow in dark mode"
    );
    expect(mermaid.render).toHaveBeenLastCalledWith(expect.any(String), "graph TD\n  A-->B");
  });

  test("must draw a drawn diagram with an id its drawing does not have when the diagrams are drawn again", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
    await renderMermaidDiagrams(page);

    await renderMermaidDiagrams(page);

    expect(mermaid.render.mock.calls[1]?.[0]).not.toBe(mermaid.render.mock.calls[0]?.[0]);
  });

  test.each([
    { condition: "has a Mermaid fence", expected: true, source: diagramSource },
    { condition: "has no Mermaid fence", expected: false, source: "```ts\nconst a = 1;\n```\n" },
  ])("must say whether the doc has diagrams when it $condition", async ({ expected, source }) => {
    const page = await renderPage(source);

    expect(hasMermaidDiagrams(page)).toBe(expected);
  });

  test("must say the doc has diagrams when they are drawn", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });

    await renderMermaidDiagrams(page);

    expect(hasMermaidDiagrams(page)).toBe(true);
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plan.md");
  return page;
}
