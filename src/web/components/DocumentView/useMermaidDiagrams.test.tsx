import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ColorMode, ColorScheme } from "../../../shared/appearance/Appearance";
import { createDocumentText } from "../../../shared/markdown/createDocumentText";
import { AppearanceProvider } from "../../appearance/AppearanceProvider";
import { useAppearance } from "../../appearance/useAppearance";
import { setAppearanceCookies } from "../../testing/setAppearanceCookies";

import { useMermaidDiagrams } from "./useMermaidDiagrams";
import type { RenderedDocument } from "./useRenderedDocument";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), parse: vi.fn(), render: vi.fn() }));

vi.mock("mermaid", () => ({ default: mermaid }));

const diagramHtml = '<div data-md-block="0"><pre><code class="language-mermaid">graph TD\n  A-->B</code></pre></div>';

const plainHtml = '<div data-md-block="0"><p>No diagrams here</p></div>';

beforeEach(() => {
  vi.resetAllMocks();
  mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });
  mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow"><text>A</text></svg>' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMermaidDiagrams", () => {
  test("must draw the diagrams when the doc has a diagram", async () => {
    const { render, waitForDrawing } = setUpTest();

    render();

    await waitForDrawing("Request flow");
  });

  test.each<{ mode: ColorMode; systemScheme: ColorScheme; theme: string }>([
    { mode: "light", systemScheme: "dark", theme: "default" },
    { mode: "dark", systemScheme: "light", theme: "dark" },
    { mode: "system", systemScheme: "dark", theme: "dark" },
    { mode: "system", systemScheme: "light", theme: "default" },
  ])(
    "must draw in Mermaid's $theme theme when the user chose $mode and the system is in $systemScheme mode",
    async ({ mode, systemScheme, theme }) => {
      const { render, waitForDrawing } = setUpTest({ mode, systemScheme });

      render();
      await waitForDrawing("Request flow");

      expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme }));
    }
  );

  test("must draw the diagrams again in dark colours when the system switches to dark mode under System", async () => {
    const { render, switchSystemScheme, waitForDrawing } = setUpTest({ mode: "system" });
    render();
    await waitForDrawing("Request flow");
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    switchSystemScheme("dark");

    await waitForDrawing("Request flow in dark mode");
    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  test("must draw the diagrams again in dark colours when the user chooses Dark", async () => {
    const { render, waitForDrawing } = setUpTest({ mode: "light" });
    const { result } = render();
    await waitForDrawing("Request flow");
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    act(() => result.current.changeAppearance({ mode: "dark" }));

    await waitForDrawing("Request flow in dark mode");
    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  test("must keep the drawing when the system switches mode while the user has chosen Light", async () => {
    const { content, render, switchSystemScheme, waitForDrawing } = setUpTest({ mode: "light" });
    render();
    await waitForDrawing("Request flow");
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    switchSystemScheme("dark");
    await flushDrawing();

    expect(content.querySelector("svg")?.getAttribute("aria-label")).toBe("Request flow");
  });

  test.each([
    { condition: "the doc has no diagrams", html: plainHtml, rendered: buildRenderedDocument() },
    { condition: "the doc has not rendered yet", html: diagramHtml, rendered: null },
  ])("must not load Mermaid when $condition", async ({ html, rendered }) => {
    const { render } = setUpTest({ html, rendered });

    render();
    await flushDrawing();

    expect(mermaid.initialize).not.toHaveBeenCalled();
  });
});

function buildRenderedDocument(): RenderedDocument {
  return { documentText: createDocumentText("# Plan\n"), hash: "hash of the plan", html: "" };
}

/**
 * Waits long enough for a drawing that had started to have loaded Mermaid
 */
function flushDrawing(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function setUpTest({
  html = diagramHtml,
  mode = "system",
  rendered = buildRenderedDocument(),
  systemScheme = "light",
}: { html?: string; mode?: ColorMode; rendered?: RenderedDocument | null; systemScheme?: ColorScheme } = {}) {
  setAppearanceCookies({ mode });
  const darkMode = Object.assign(new EventTarget(), { matches: systemScheme === "dark" });
  vi.stubGlobal("matchMedia", () => darkMode);
  const content = document.createElement("div");
  content.innerHTML = html;
  const contentRef = { current: content };

  const render = () =>
    renderHook(
      ({ rendered: current }) => {
        useMermaidDiagrams(contentRef, current);
        return useAppearance();
      },
      { initialProps: { rendered }, wrapper: AppearanceProvider }
    );
  const switchSystemScheme = (scheme: ColorScheme): void => {
    act(() => {
      darkMode.matches = scheme === "dark";
      darkMode.dispatchEvent(new Event("change"));
    });
  };
  const waitForDrawing = (label: string) =>
    waitFor(() => expect(content.querySelector("svg")?.getAttribute("aria-label")).toBe(label));

  return { content, render, switchSystemScheme, waitForDrawing };
}
