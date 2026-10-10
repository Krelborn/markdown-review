import { render as renderBase, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { buildPassageAnchor, buildThread } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import { DocumentView } from "./DocumentView";
import {
  hoveredHighlightName,
  overlapHighlightName,
  pendingHighlightName,
  selectedHighlightName,
  threadsHighlightName,
} from "./useThreadHighlights";

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

const todayAnchor = buildPassageAnchor({
  anchoredText: "24h today",
  endOffset: 35,
  quote: "24h today",
  startOffset: 26,
});

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

  test("must frame the block when the pointer is on its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));

    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must stop framing the block when the pointer leaves its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const block = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(block);
    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    await user.hover(block);

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must keep the block framed when the pointer leaves the + while it has focus", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const block = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(block);
    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));
    await tabToBlockButton(user);

    await user.hover(block);

    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must keep focus on the + when the pointer moves over another block", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);

    await user.hover(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" }));

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveFocus();
  });

  test("must keep the + and its frame when the pointer leaves the doc while the + has focus", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);

    await user.hover(document.body);

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveFocus();
    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must keep the block framed when the user writes a comment on the whole of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 84,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries happen three times.",
        startOffset: 57,
        suffix: "",
      },
    });

    await render();

    expect(await screen.findByTestId("block-target")).toBeInTheDocument();
  });

  test("must not frame a block when the user writes a comment on part of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 64,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries",
        startOffset: 57,
        suffix: " happen three times.",
      },
    });

    await render();

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
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

  test("must highlight the passage of the comment the user is writing", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
    });

    await render();

    expect(elements.highlighted(pendingHighlightName)).toEqual(["cache results for 24h"]);
  });

  test("must deepen the highlight when two threads' passages overlap", async () => {
    const { render } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: todayAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(overlapHighlightName)).toEqual(["24h"]);
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

  test("must report the thread of a highlight when the pointer moves over it", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });

    await user.hover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
  });

  test("must report no hovered thread when the pointer leaves the doc", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await user.unhover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the pointer moves off a highlight after its thread is selected", async () => {
    const { onHoverThread, render, rerender } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
    await rerender(plan, { selectedThreadId: 1 });
    const plainText = within(elements.article()).getByText("Retries happen three times.");
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 0, offsetNode: plainText.firstChild }) });

    await user.hover(plainText);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the last highlighted thread goes away while the pointer is on it", async () => {
    const { onHoverThread, render, rerender } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await rerender(plan, { threads: [] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the thread under the pointer goes away while another stays highlighted", async () => {
    const retries = buildThread({ anchor: retriesAnchor, id: 2 });
    const { onHoverThread, render, rerender } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), retries],
    });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await rerender(plan, { threads: [retries] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the doc goes away while the pointer is on a highlight", async () => {
    const { onHoverThread, render, unmount } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    unmount();

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must not look for a highlight under the pointer when the doc has no highlighted threads", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    const caretPositionFromPoint = vi.fn();
    Object.assign(document, { caretPositionFromPoint });
    await render();

    await user.hover(within(elements.article()).getByText("We cache results for", { exact: false }));
    await new Promise(requestAnimationFrame);

    expect(caretPositionFromPoint).not.toHaveBeenCalled();
  });

  test("must emphasise the passage of a thread when the user points at it in the comments", async () => {
    const { render } = setUpTest({
      hoveredThreadId: 1,
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: retriesAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(hoveredHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(threadsHighlightName)).toEqual(["Retries"]);
  });

  test("must report a thread as hovered when the pointer is over its marker", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });

  test("must report no hovered thread when the marker under the pointer goes away", async () => {
    const retries = buildThread({ anchor: retriesAnchor, id: 2 });
    const { onHoverThread, render, rerender } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), retries],
    });
    const user = userEvent.setup();
    await render();
    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    await rerender(plan, { threads: [retries] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the doc goes away while the pointer is on a marker", async () => {
    const { onHoverThread, render, unmount } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    unmount();

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must paint each kind of highlight over the kinds before it when the doc has every kind", async () => {
    const { render } = setUpTest({
      hoveredThreadId: 3,
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
      selectedThreadId: 4,
      threads: [
        buildThread({ anchor: cacheAnchor, id: 1 }),
        buildThread({ anchor: todayAnchor, id: 2 }),
        buildThread({ anchor: retriesAnchor, id: 3 }),
        buildThread({ anchor: retriesAnchor, id: 4 }),
      ],
    });

    await render();

    expect(elements.priority(overlapHighlightName)).toBeGreaterThan(elements.priority(threadsHighlightName));
    expect(elements.priority(hoveredHighlightName)).toBeGreaterThan(elements.priority(overlapHighlightName));
    expect(elements.priority(selectedHighlightName)).toBeGreaterThan(elements.priority(hoveredHighlightName));
    expect(elements.priority(pendingHighlightName)).toBeGreaterThan(elements.priority(selectedHighlightName));
  });

  test("must show a linked doc in the page when the user follows a link to it", async () => {
    const { onNavigate, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "spec" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md#goals");
  });

  test("must copy the page's address, holding the heading, when the user clicks a heading's link", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
    expect(await navigator.clipboard.readText()).toBe(location.href);
  });

  test("must still put the heading in the address when the browser refuses the copy", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Denied", "NotAllowedError"));

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
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

  test("must keep showing the doc when the address names a heading with a malformed escape", async () => {
    const { render } = setUpTest({ hash: "#%E0%A4%A" });

    await render();

    expect(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" })).toBeInTheDocument();
  });

  test("must scroll to the doc's heading when the app's page has an element with the same id", async () => {
    const appRoot = document.createElement("div");
    appRoot.id = "goals";
    document.body.prepend(appRoot);
    onTestFinished(() => appRoot.remove());
    const scrolledTo: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
      scrolledTo.push(`${this.tagName}#${this.id}`);
    });
    const { render } = setUpTest({ hash: "#goals" });

    await render();

    await waitFor(() => expect(scrolledTo).toEqual(["H2#goals"]));
  });

  test.each([
    { passageTop: 40, side: "above" },
    { passageTop: 600, side: "below" },
  ])(
    "must scroll the selected thread's passage into view when it lies $side the box the doc scrolls in",
    async ({ passageTop }) => {
      const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop });

      await render();

      await waitFor(() => expect(scrolledTo).toEqual(["P"]));
    }
  );

  test("must leave the doc where it is when the selected thread's passage lies inside the box the doc scrolls in", async () => {
    const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop: 200 });

    await render();
    await screen.findByRole("button", { name: "Thread #1" });

    expect(scrolledTo).toEqual([]);
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
  container?: HTMLElement;
  hash?: string;
  hoveredThreadId?: number | null;
  pendingPassage?: NewPassageAnchor | null;
  selectedThreadId?: number | null;
  threads?: Thread[];
}

function setUpTest({
  container,
  hash = "",
  hoveredThreadId = null,
  pendingPassage = null,
  selectedThreadId = null,
  threads = [],
}: SetUpOptions = {}) {
  const onComment = vi.fn();
  const onHoverThread = vi.fn();
  const onNavigate = vi.fn();
  const onSelectThread = vi.fn();
  const view = (shown: DocumentSource, shownSelectedThreadId: number | null, shownThreads: Thread[]) => (
    <HoveredThreadContext value={{ hoveredThreadId, onFocusThread: () => {}, onHoverThread }}>
      <DocumentView
        document={shown}
        hash={hash}
        onComment={onComment}
        onNavigate={onNavigate}
        onSelectThread={onSelectThread}
        pendingPassage={pendingPassage}
        revealCount={0}
        selectedThreadId={shownSelectedThreadId}
        threads={shownThreads}
      />
    </HoveredThreadContext>
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  let unmount: () => void = () => {};
  const render = async (shown = plan): Promise<void> => {
    ({ rerender: rerenderBase, unmount } = renderBase(view(shown, selectedThreadId, threads), { container }));
    if (shown.source !== "") {
      await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
    }
  };
  const rerender = async (
    shown: DocumentSource,
    {
      selectedThreadId: rerenderedSelectedThreadId = selectedThreadId,
      threads: rerenderedThreads = threads,
    }: { selectedThreadId?: number | null; threads?: Thread[] } = {}
  ): Promise<void> => {
    rerenderBase(view(shown, rerenderedSelectedThreadId, rerenderedThreads));
    await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
  };
  return { onComment, onHoverThread, onNavigate, onSelectThread, render, rerender, unmount: () => unmount() };
}

/**
 * Sets up a test whose doc renders inside a scrolling box from 100px to 500px down the page, with every range in the
 * doc measured at the given distance down the page
 */
function setUpTestWithScrollContainer({ passageTop }: { passageTop: number }) {
  const scrollContainer = document.createElement("div");
  scrollContainer.style.overflowY = "auto";
  document.body.append(scrollContainer);
  vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 800, 400));
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, passageTop, 200, 20));
  const scrolledTo: string[] = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
    scrolledTo.push(this.tagName);
  });
  const setUp = setUpTest({
    container: scrollContainer,
    selectedThreadId: 1,
    threads: [buildThread({ anchor: cacheAnchor, id: 1 })],
  });
  return { ...setUp, scrolledTo };
}

/**
 * Moves keyboard focus from the start of the page to the + beside the hovered block, past each of the doc's links
 */
async function tabToBlockButton(user: UserEvent): Promise<void> {
  const linkCount = within(elements.article()).getAllByRole("link").length;
  for (let tabCount = 0; tabCount <= linkCount; tabCount += 1) {
    await user.tab();
  }
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
  // NaN when no highlight has the name, as no comparison with NaN passes
  priority: (name: string): number => CSS.highlights.get(name)?.priority ?? Number.NaN,
  markers: (): string[] =>
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((label) => label.startsWith("Thread #")),
};
