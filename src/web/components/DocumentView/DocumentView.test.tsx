import { render as renderBase, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { buildPassageAnchor, buildThread } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";

import { DocumentView } from "./DocumentView";
import { selectedHighlightName, threadsHighlightName } from "./useThreadHighlights";

const source = [
  "# Plan",
  "",
  "We cache results for **24h** today. See the [spec](spec.md#goals).",
  "",
  "## Goals",
  "",
  "Retries happen three times.",
  "",
].join("\n");

const plan: DocumentSource = { hash: "hash of the plan", path: "docs/plan.md", source };

const cacheAnchor = buildPassageAnchor({ endOffset: 29, prefix: "Plan\nWe ", startOffset: 8 });

const retriesAnchor = buildPassageAnchor({ anchoredText: "Retries", endOffset: 64, quote: "Retries", startOffset: 57 });

afterEach(() => {
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  vi.restoreAllMocks();
});

describe("DocumentView", () => {
  test("must show the rendered doc when it opens", async () => {
    const { render } = setUpTest();

    await render();

    expect(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" })).toHaveAttribute("id", "goals");
  });

  test("must start a comment on the selected text when the user clicks Comment beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    selectText("cache", "24h");
    await user.click(await screen.findByRole("button", { name: "Comment" }));

    expect(onComment).toHaveBeenCalledWith({
      anchor: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: " today. See the spec.\nGoals\nRetr",
      },
      renderedHash: "hash of the plan",
    });
  });

  test("must start a comment on the whole block when the user presses + beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await user.click(screen.getByRole("button", { name: "Comment on this block" }));

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Retries happen three times." }) })
    );
  });

  test("must start a comment on the whole doc when the user asks to", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "Comment on this doc" }));

    expect(onComment).toHaveBeenCalledWith({ anchor: { document: "docs/plan.md", kind: "document" } });
  });

  test("must highlight open and draft passages, and the selected thread's apart, but not resolved or outdated ones", async () => {
    const { render } = setUpTest({
      selectedThreadId: 2,
      threads: [
        buildThread({ anchor: cacheAnchor, id: 1 }),
        buildThread({ anchor: retriesAnchor, id: 2 }),
        buildThread({ anchor: retriesAnchor, id: 3, status: "resolved" }),
        buildThread({ anchor: { ...cacheAnchor, outdated: true }, id: 4 }),
      ],
    });

    await render();

    expect(elements.highlighted(threadsHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(selectedHighlightName)).toEqual(["Retries"]);
    expect(screen.getAllByRole("button", { name: /^Thread #/ }).map((marker) => marker.textContent)).toEqual([
      "1",
      "2",
    ]);
  });

  test("must select a thread when the user clicks its marker", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "Thread #1" }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must select a thread when the user clicks its highlighted text", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("We cache results for", { exact: false }).firstChild;
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: text }) });

    await user.click(within(elements.article()).getByText("We cache results for", { exact: false }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must show a linked doc in the page when the user follows a link to it", async () => {
    const { onNavigate, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "spec" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md#goals");
  });

  test("must still offer a comment on the whole doc when the doc is empty", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render({ ...plan, source: "" });

    await user.click(screen.getByRole("button", { name: "Comment on this doc" }));

    expect(elements.article()).toBeEmptyDOMElement();
    expect(onComment).toHaveBeenCalledWith({ anchor: { document: "docs/plan.md", kind: "document" } });
  });

  test("must stop offering Comment when the user selects text outside the doc", async () => {
    const { render } = setUpTest();
    await render();
    const outside = document.createElement("p");
    outside.textContent = "Sidebar text";
    document.body.append(outside);
    selectText("cache", "24h");
    const comment = await screen.findByRole("button", { name: "Comment" });

    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    await waitForElementToBeRemoved(comment);
  });

  test("must scroll to the heading the address names once, and keep the user's place when the doc changes", async () => {
    const scrolledTo: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
      scrolledTo.push(this.id);
    });
    const { render, rerender } = setUpTest({ hash: "#goals" });
    await render();
    await waitFor(() => expect(scrolledTo).toEqual(["goals"]));

    await rerender({ ...plan, source: `${source}\nAnother paragraph.\n` });

    expect(await within(elements.article()).findByText("Another paragraph.")).toBeInTheDocument();
    expect(scrolledTo).toEqual(["goals"]);
  });

  test("must show the new text in place when the doc's source changes", async () => {
    const { render, rerender } = setUpTest();
    await render();

    await rerender({ ...plan, source: "# Plan\n\nWe cache results for 1h today.\n" });

    expect(await within(elements.article()).findByText("We cache results for 1h today.")).toBeInTheDocument();
    expect(within(elements.article()).queryByText("Retries happen three times.")).not.toBeInTheDocument();
  });
});

interface SetUpOptions {
  hash?: string;
  selectedThreadId?: number | null;
  threads?: Thread[];
}

function setUpTest({ hash = "", selectedThreadId = null, threads = [] }: SetUpOptions = {}) {
  const onComment = vi.fn();
  const onNavigate = vi.fn();
  const onSelectThread = vi.fn();
  const view = (shown: DocumentSource) => (
    <DocumentView
      document={shown}
      hash={hash}
      onComment={onComment}
      onNavigate={onNavigate}
      onSelectThread={onSelectThread}
      selectedThreadId={selectedThreadId}
      threads={threads}
    />
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  const render = async (shown = plan): Promise<void> => {
    rerenderBase = renderBase(view(shown)).rerender;
    if (shown.source !== "") {
      await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
    }
  };
  const rerender = async (shown: DocumentSource): Promise<void> => {
    rerenderBase(view(shown));
    await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
  };
  return { onComment, onNavigate, onSelectThread, render, rerender };
}

function selectText(from: string, through: string): void {
  const article = elements.article();
  const start = within(article).getByText(from, { exact: false }).firstChild;
  const end = within(article).getByText(through).firstChild;
  const range = document.createRange();
  range.setStart(start ?? article, start?.textContent?.indexOf(from) ?? 0);
  range.setEnd(end ?? article, through.length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

const elements = {
  article: () => screen.getByRole("article", { name: "docs/plan.md" }),
  highlighted: (name: string): string[] => [...(CSS.highlights.get(name) ?? [])].map((range) => range.toString()),
  markers: (): string[] =>
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((label) => label.startsWith("Thread #")),
};
