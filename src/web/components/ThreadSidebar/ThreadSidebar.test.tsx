import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import type { NewComment } from "../../review/NewComment";
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

  test("must save the user's comment on the whole review as a draft when the user adds one", async () => {
    const { fake, onChanged, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.type(
      screen.getByRole("textbox", { name: "Comment on the whole review" }),
      "The spec and plan disagree."
    );
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { kind: "review" }, draft: { body: "The spec and plan disagree." } },
    ]);
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Comment on the whole review" })).toHaveValue("");
  });

  test("must ask for the comment with the text box ready when the user starts one in the doc", async () => {
    const newComment: NewComment = {
      anchor: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
      renderedHash: "hash of docs/plan.md",
    };
    const { fake, onCloseNewComment, render } = setUpTest({ newComment, threads: [] });
    const user = userEvent.setup();
    render();

    await user.keyboard("Too long?");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { quote: "cache results for 24h", startLine: 3 }, draft: { body: "Too long?" }, status: "draft" },
    ]);
    expect(onCloseNewComment).toHaveBeenCalled();
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
    const card = within(screen.getByRole("article", { name: "Thread #2" }));
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
  newComment = null,
  threads: shown = threads,
}: { newComment?: NewComment | null; threads?: Thread[] } = {}) {
  localStorage.clear();
  const fake = createFakeReviewApi({ threads: shown });
  const onChanged = vi.fn();
  const onCloseNewComment = vi.fn();
  const onSelectThread = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ThreadSidebar
          documentPath="docs/plan.md"
          newComment={newComment}
          onChanged={onChanged}
          onCloseNewComment={onCloseNewComment}
          onSelectThread={onSelectThread}
          selectedThreadId={null}
          threads={shown}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onCloseNewComment, onSelectThread, render };
}

const elements = {
  groupTitles: (): string[] => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  threadsIn: (group: string): string[] =>
    within(screen.getByRole("region", { name: group }))
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? ""),
};
