import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderDocument } from "./renderDocument";
import { renderMermaidDiagrams } from "./renderMermaidDiagrams";

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
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plan.md");
  return page;
}
