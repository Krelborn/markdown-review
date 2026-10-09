import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createDocumentText } from "../../../shared/markdown/createDocumentText";

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

  test("must listen for the system switching between light and dark mode when the doc has a diagram", async () => {
    const { darkMode, matchMedia, render, waitForDrawing } = setUpTest();

    render();
    await waitForDrawing("Request flow");

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(darkMode.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  test("must draw the diagrams again when the system switches between light and dark mode", async () => {
    const { render, switchColorScheme, waitForDrawing } = setUpTest();
    render();
    await waitForDrawing("Request flow");
    mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow in dark mode"><text>A</text></svg>' });

    switchColorScheme();

    await waitForDrawing("Request flow in dark mode");
  });

  test("must stop listening for the switch when the doc is unmounted", async () => {
    const { darkMode, listener, render, waitForDrawing } = setUpTest();
    const { unmount } = render();
    await waitForDrawing("Request flow");
    const subscribed = listener();

    unmount();

    expect(darkMode.removeEventListener).toHaveBeenCalledWith("change", subscribed);
  });

  test("must stop listening for the switch when the doc no longer has diagrams", async () => {
    const { content, darkMode, listener, render, waitForDrawing } = setUpTest();
    const { rerender } = render();
    await waitForDrawing("Request flow");
    const subscribed = listener();
    content.innerHTML = plainHtml;

    rerender({ rendered: buildRenderedDocument() });

    expect(darkMode.removeEventListener).toHaveBeenCalledWith("change", subscribed);
    expect(darkMode.addEventListener).toHaveBeenCalledTimes(1);
  });

  test.each([
    { condition: "the doc has no diagrams", html: plainHtml, rendered: buildRenderedDocument() },
    { condition: "the doc has not rendered yet", html: diagramHtml, rendered: null },
  ])("must not look up the color scheme when $condition", ({ html, rendered }) => {
    const { matchMedia, render } = setUpTest({ html, rendered });

    render();

    expect(matchMedia).not.toHaveBeenCalled();
  });
});

function buildRenderedDocument(): RenderedDocument {
  return { documentText: createDocumentText("# Plan\n"), html: "" };
}

function setUpTest({
  html = diagramHtml,
  rendered = buildRenderedDocument(),
}: { html?: string; rendered?: RenderedDocument | null } = {}) {
  const darkMode = {
    addEventListener: vi.fn<(type: string, listener: () => void) => void>(),
    removeEventListener: vi.fn<(type: string, listener: () => void) => void>(),
  };
  const matchMedia = vi.fn(() => darkMode);
  vi.stubGlobal("matchMedia", matchMedia);
  const content = document.createElement("div");
  content.innerHTML = html;
  const contentRef = { current: content };

  const render = () =>
    renderHook(({ rendered: current }) => useMermaidDiagrams(contentRef, current), {
      initialProps: { rendered },
    });
  const listener = (): (() => void) => {
    const subscribed = darkMode.addEventListener.mock.lastCall?.[1];
    if (subscribed === undefined) {
      throw new Error("The hook did not listen for the system switching between light and dark mode");
    }
    return subscribed;
  };
  const switchColorScheme = (): void => listener()();
  const waitForDrawing = (label: string) =>
    waitFor(() => expect(content.querySelector("svg")?.getAttribute("aria-label")).toBe(label));

  return { content, darkMode, listener, matchMedia, render, switchColorScheme, waitForDrawing };
}
