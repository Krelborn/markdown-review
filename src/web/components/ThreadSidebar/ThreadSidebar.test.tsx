import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { CommentEditorHarness } from "../../testing/CommentEditorHarness";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadSidebar } from "./ThreadSidebar";

const agentReply = { at: "2026-10-08T09:05:00.000Z", author: "agent" as const, body: "Changed to 1h" };

const threads: Thread[] = [
  buildThread({
    anchor: buildPassageAnchor(),
    draft: { at: testTime, body: "Why 24h?" },
    id: 1,
    messages: [],
    status: "draft",
  }),
  buildThread({ anchor: buildPassageAnchor({ startOffset: 40 }), id: 2 }),
  buildThread({ anchor: buildPassageAnchor({ outdated: true }), id: 3 }),
  buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 4, status: "resolved" }),
  buildThread({ anchor: { kind: "review" }, id: 5 }),
  buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 6 }),
];

describe("ThreadSidebar", () => {
  test("must group this doc's threads and the review's into drafts, open, outdated and resolved", () => {
    const { render } = setUpTest();

    render();

    expect(elements.groupTitles()).toEqual(["Drafts 1", "Open 2", "Outdated 1", "Resolved 1"]);
    expect(elements.threadsIn("Drafts")).toEqual(["Thread #1"]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2"]);
    expect(elements.threadsIn("Outdated")).toEqual(["Thread #3"]);
    expect(elements.threadsIn("Resolved")).toEqual(["Thread #4"]);
  });

  test("must keep resolved threads folded away when the sidebar opens", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("article", { name: "Thread #4" })).not.toBeVisible();
  });

  test("must show every doc's threads under their doc when the user chooses All docs", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("radio", { name: "All docs" }));

    const open = within(screen.getByRole("region", { name: "Open" }));
    expect(open.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Whole review",
      "docs/plan.md",
      "docs/spec.md",
    ]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2", "Thread #6"]);
  });

  test("must save a comment on the whole review as a draft when the user starts one from + Comment", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));
    await user.keyboard("The spec and plan disagree.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { kind: "review" }, draft: { body: "The spec and plan disagree." }, status: "draft" },
    ]);
    expect(screen.queryByRole("region", { name: "New comment" })).not.toBeInTheDocument();
  });

  test("must start a comment on the whole doc, with its text box ready, when the user picks On this doc", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On this doc" }));

    const composer = within(screen.getByRole("region", { name: "New comment" }));
    expect(composer.getByText("Whole doc")).toBeInTheDocument();
    expect(composer.getByRole("textbox", { name: "Comment on the whole doc" })).toHaveFocus();
  });

  test("must start a comment on the whole review straight away when the docs list is on screen", async () => {
    const { render } = setUpTest({ documentPath: null, threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "+ Review comment" }));

    expect(screen.getByRole("textbox", { name: "Comment on the whole review" })).toHaveFocus();
  });

  test("must close the composer without saving when the user cancels it", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "+ Comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));
    await user.keyboard("Never mind");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("region", { name: "New comment" })).not.toBeInTheDocument();
    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must keep one editor open when the user starts a reply while editing a draft", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(within(elements.thread(2)).getByRole("textbox", { name: "Reply" })).toBeInTheDocument();
  });

  test("must stop marking the agent's reply as new when the user selects its thread", async () => {
    const replied = buildThread({
      anchor: buildPassageAnchor(),
      id: 2,
      messages: [...buildThread().messages, agentReply],
    });
    const { onSelectThread, render } = setUpTest({ threads: [replied] });
    const user = userEvent.setup();
    render();
    const card = within(elements.thread(2));
    const wasNew = card.queryByText("New reply") !== null;

    await user.click(card.getByRole("button", { name: "#2 Line 3" }));

    expect(wasNew).toBe(true);
    expect(card.queryByText("New reply")).not.toBeInTheDocument();
    expect(onSelectThread).toHaveBeenCalledWith(replied);
  });

  test("must say how to comment when there are no threads", () => {
    const { render } = setUpTest({ threads: [] });

    render();

    expect(
      screen.getByText("No comments yet. Select text in the doc, or press + beside a block, to comment on it.")
    ).toBeInTheDocument();
  });
});

function setUpTest({
  documentPath = "docs/plan.md",
  threads: shown = threads,
}: { documentPath?: string | null; threads?: Thread[] } = {}) {
  localStorage.clear();
  const fake = createFakeReviewApi({ threads: shown });
  const onChanged = vi.fn();
  const onSelectThread = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <CommentEditorHarness onChanged={onChanged} threads={shown}>
          {(editor) => (
            <ThreadSidebar
              documentPath={documentPath}
              editor={editor}
              onChanged={onChanged}
              onSelectThread={onSelectThread}
              selectedThreadId={null}
              threads={shown}
            />
          )}
        </CommentEditorHarness>
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onSelectThread, render };
}

const elements = {
  groupTitles: (): string[] => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  thread: (id: number) => screen.getByRole("article", { name: `Thread #${id}` }),
  threadsIn: (group: string): string[] =>
    within(screen.getByRole("region", { name: group }))
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? ""),
};
