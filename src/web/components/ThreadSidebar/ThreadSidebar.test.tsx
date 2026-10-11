import { act, fireEvent, render as renderBase, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { CommentEditorHarness } from "../../testing/CommentEditorHarness";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadSidebar } from "./ThreadSidebar";

const agentReply = { at: "2026-10-08T09:05:00.000Z", author: "agent" as const, body: "Changed to 1h" };

const replied = buildThread({ anchor: buildPassageAnchor(), id: 2, messages: [...buildThread().messages, agentReply] });

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

  test("must open the Resolved group when a resolved thread gets a reply the user hasn't seen", () => {
    const resolved = buildThread({ anchor: buildPassageAnchor(), id: 4, status: "resolved" });
    const { render, showThreads } = setUpTest({ threads: [resolved] });
    render();

    showThreads([{ ...resolved, messages: [...resolved.messages, agentReply] }]);

    expect(elements.thread(4)).toBeVisible();
  });

  test.each([
    { count: 1, expected: "1 new reply" },
    { count: 2, expected: "2 new replies" },
  ])(
    "must count the resolved threads with replies the user hasn't seen as '$expected' while the group is folded",
    async ({ count, expected }) => {
      const resolved = [4, 7].slice(0, count).map((id) =>
        buildThread({
          anchor: buildPassageAnchor({ startOffset: id }),
          id,
          messages: [...buildThread().messages, agentReply],
          status: "resolved",
        })
      );
      const { render } = setUpTest({ threads: resolved });
      const user = userEvent.setup();
      render();

      await user.click(screen.getByRole("heading", { name: `Resolved ${count}` }));

      expect(elements.thread(4)).not.toBeVisible();
      expect(within(screen.getByRole("region", { name: "Resolved" })).getByText(expected)).toBeVisible();
    }
  );

  test("must keep the Resolved group folded when the user folds it and no new reply arrives", async () => {
    const resolved = buildThread({
      anchor: buildPassageAnchor(),
      id: 4,
      messages: [...buildThread().messages, agentReply],
      status: "resolved",
    });
    const { render, showThreads } = setUpTest({ threads: [resolved] });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("heading", { name: "Resolved 1" }));

    showThreads([{ ...resolved, updatedAt: "2026-10-08T10:00:00.000Z" }]);

    expect(elements.thread(4)).not.toBeVisible();
  });

  test.each([
    { action: "saves", button: "Save" },
    { action: "cancels", button: "Cancel" },
  ])("must keep the resolved threads open when the user $action a reply to one of them", async ({ button }) => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("heading", { name: "Resolved 1" }));
    await user.click(within(elements.thread(4)).getByRole("button", { name: "Reply" }));
    await user.type(within(elements.thread(4)).getByRole("textbox", { name: "Reply" }), "Reopen?");

    await user.click(within(elements.thread(4)).getByRole("button", { name: button }));

    expect(elements.thread(4)).toBeVisible();
  });

  test("must show every doc's threads under their doc when the user chooses All docs", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("tab", { name: "All docs 6" }));

    const open = within(screen.getByRole("region", { name: "Open" }));
    expect(open.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Whole review",
      "docs/plan.md",
      "docs/spec.md",
    ]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2", "Thread #6"]);
  });

  test("must count each view's threads on its tab when another doc has threads", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["This doc 5", "All docs 6"]);
  });

  test("must show the title and count, and no tabs, when only this doc and the review have threads", () => {
    const { render } = setUpTest({ threads: threads.slice(0, 5) });

    render();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Comments")).toHaveTextContent("Comments 5");
  });

  test("must keep the title, without a count, and the + Comment button when the tabs show", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByText("Comments").textContent).toBe("Comments");
    expect(screen.getByRole("button", { name: "New comment" })).toBeInTheDocument();
  });

  test("must go back to This doc when the user chose All docs and the other doc's threads went", async () => {
    const { render, showThreads } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("tab", { name: "All docs 6" }));

    showThreads(threads.slice(0, 5));
    showThreads(threads);

    expect(screen.getByRole("tab", { name: "This doc 5" })).toHaveAttribute("aria-selected", "true");
  });

  test("must keep the resolved threads open when the user switches tabs and back", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("heading", { name: "Resolved 1" }));

    await user.click(screen.getByRole("tab", { name: "All docs 6" }));
    await user.click(screen.getByRole("tab", { name: "This doc 5" }));

    expect(elements.thread(4)).toBeVisible();
  });

  test("must keep focus on the tab when the user switches tabs with an editor open", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.click(screen.getByRole("tab", { name: "All docs 6" }));

    expect(screen.getByRole("tab", { name: "All docs 6" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Reply" })).toBeInTheDocument();
  });

  test("must save a comment on the whole review as a draft when the user starts one from + Comment", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "New comment" }));
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

    await user.click(screen.getByRole("button", { name: "New comment" }));
    await user.click(screen.getByRole("button", { name: "On this doc" }));

    const composer = within(screen.getByRole("region", { name: "New comment" }));
    expect(composer.getByText("Whole doc")).toBeInTheDocument();
    expect(composer.getByRole("textbox", { name: "Comment on the whole doc" })).toHaveFocus();
  });

  test("must start a comment on the whole review straight away when the docs list is on screen", async () => {
    const { render } = setUpTest({ documentPath: null, threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Review comment" }));

    expect(screen.getByRole("textbox", { name: "Comment on the whole review" })).toHaveFocus();
  });

  test("must close the composer without saving when the user cancels it", async () => {
    const { fake, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "New comment" }));
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

  test("must stop marking the agent's reply as new when the thread is selected in the doc", () => {
    const { render, select } = setUpTest({ threads: [replied] });
    render();
    const wasNew = within(elements.thread(2)).queryByText("New reply") !== null;

    select(2);

    expect(wasNew).toBe(true);
    expect(within(elements.thread(2)).queryByText("New reply")).not.toBeInTheDocument();
  });

  test("must keep marking the agent's reply as new when it arrives on the selected thread", () => {
    const { render, select, showThreads } = setUpTest({
      threads: [buildThread({ anchor: buildPassageAnchor(), id: 2 })],
    });
    render();
    select(2);

    showThreads([replied]);

    expect(within(elements.thread(2)).getByText("New reply")).toBeInTheDocument();
  });

  test("must stop marking the agent's reply as new when the user selects the selected thread in the doc again", () => {
    const { render, select, showThreads } = setUpTest({
      threads: [buildThread({ anchor: buildPassageAnchor(), id: 2 })],
    });
    render();
    select(2);
    showThreads([replied]);
    const wasNew = within(elements.thread(2)).queryByText("New reply") !== null;

    select(2);

    expect(wasNew).toBe(true);
    expect(within(elements.thread(2)).queryByText("New reply")).not.toBeInTheDocument();
  });

  test("must keep marking the agent's reply on the selected thread as new when the other docs' threads go", () => {
    const otherDocument = buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 6 });
    const { render, select, showThreads } = setUpTest({
      threads: [buildThread({ anchor: buildPassageAnchor(), id: 2 }), otherDocument],
    });
    render();
    select(2);
    showThreads([replied, otherDocument]);
    const wasNew = within(elements.thread(2)).queryByText("New reply") !== null;

    showThreads([replied]);

    expect(wasNew).toBe(true);
    expect(within(elements.thread(2)).getByText("New reply")).toBeInTheDocument();
  });

  test.each<{ action: string; button: string; thread: Thread }>([
    { action: "replies", button: "Reply", thread: replied },
    { action: "resolves the thread", button: "Resolve", thread: replied },
    {
      action: "edits their draft reply",
      button: "Edit",
      thread: { ...replied, draft: { at: testTime, body: "Hourly" } },
    },
  ])("must stop marking the agent's reply as new when the user $action", async ({ button, thread }) => {
    const { render } = setUpTest({ threads: [thread] });
    const user = userEvent.setup();
    render();

    await user.click(within(elements.thread(2)).getByRole("button", { name: button }));

    expect(within(elements.thread(2)).queryByText("New reply")).not.toBeInTheDocument();
  });

  test("must stop marking the agent's reply as new when the user discards their draft reply", async () => {
    const { render } = setUpTest({ threads: [{ ...replied, draft: { at: testTime, body: "Hourly" } }] });
    const user = userEvent.setup();
    render();

    await discardDraftOnThread(user, 2, "Discard this reply?");

    expect(within(elements.thread(2)).queryByText("New reply")).not.toBeInTheDocument();
  });

  test("must say how to comment when there are no threads", () => {
    const { render } = setUpTest({ threads: [] });

    render();

    expect(
      screen.getByText("No comments yet. Select text in the doc, or press + beside a block, to comment on it.")
    ).toBeInTheDocument();
  });

  test("must hide the empty-panel hint while the composer is open", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "New comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));

    expect(
      screen.queryByText("No comments yet. Select text in the doc, or press + beside a block, to comment on it.")
    ).not.toBeInTheDocument();
  });

  test("must ask what to do with a reply's text, and say what waits, when the user starts editing a draft", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Save this comment first?");
    expect(screen.getByRole("alert")).toHaveTextContent("You started editing #1.");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  test("must save the reply and open the draft when the user answers Save", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("textbox", { name: "Draft comment" })).toHaveValue("Why 24h?");
    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly");
  });

  test("must throw the reply away and open the draft when the user answers Discard", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(within(elements.thread(2)).getByRole("button", { name: "Discard" }));

    expect(screen.getByRole("textbox", { name: "Draft comment" })).toHaveValue("Why 24h?");
    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
  });

  test("must keep a reply the user starts while a draft is being discarded when the discard finishes", async () => {
    const { fake, render } = setUpTest();
    let finishDiscard = (): void => {};
    fake.api.deleteDraft.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDiscard = () => resolve();
      })
    );
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Discard" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Discard this comment?" })).getByRole("button", { name: "Discard" })
    );
    await startReplyOnThread(user, 2, "Hourly");

    await act(async () => finishDiscard());

    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
  });

  test("must move focus to the next card's location when the user discards a draft comment", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await discardDraftOnThread(user, 1, "Discard this comment?");

    expect(screen.getByRole("button", { name: "#5 Whole review" })).toHaveFocus();
  });

  test("must move focus to the previous card's location when the user discards the last card's draft", async () => {
    const drafts = [
      buildThread({
        anchor: buildPassageAnchor(),
        draft: { at: testTime, body: "Why?" },
        id: 1,
        messages: [],
        status: "draft",
      }),
      buildThread({
        anchor: buildPassageAnchor({ startOffset: 40 }),
        draft: { at: testTime, body: "And this?" },
        id: 2,
        messages: [],
        status: "draft",
      }),
    ];
    const { render } = setUpTest({ threads: drafts });
    const user = userEvent.setup();
    render();

    await discardDraftOnThread(user, 2, "Discard this comment?");

    expect(screen.getByRole("button", { name: "#1 Line 3" })).toHaveFocus();
  });

  test("must move focus to + Comment when the user discards the draft of the only card in view", async () => {
    const { render } = setUpTest({ threads: threads.filter(({ id }) => id === 1 || id === 4) });
    const user = userEvent.setup();
    render();

    await discardDraftOnThread(user, 1, "Discard this comment?");

    expect(screen.getByRole("button", { name: "New comment" })).toHaveFocus();
  });

  test("must move focus to Reply when the user discards a draft reply", async () => {
    const withDraftReply = buildThread({
      anchor: buildPassageAnchor(),
      draft: { at: testTime, body: "Hourly" },
      id: 2,
    });
    const { fake, render, showThreads } = setUpTest({ threads: [withDraftReply] });
    const user = userEvent.setup();
    render();

    await discardDraftOnThread(user, 2, "Discard this reply?");
    showThreads(fake.snapshot.threads);

    expect(within(elements.thread(2)).getByRole("button", { name: "Reply" })).toHaveFocus();
  });

  test("must move focus to Save again when the user starts yet another comment while asked", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();

    await user.click(within(elements.thread(5)).getByRole("button", { name: "Reply" }));

    expect(screen.getByRole("alert")).toHaveTextContent("You started a reply to #5.");
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  test("must keep the reply and go back to it when the user keeps editing", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveFocus();
  });

  test("must leave the caret where it was when the user keeps editing", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.keyboard(" Or 1h?{ArrowLeft>3/}");
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByRole("textbox", { name: "Draft comment" })).toHaveProperty(
      "selectionStart",
      "Why 24h? Or 1h?".length - 3
    );
  });

  test("must offer to discard only the changes when the user has edited a saved draft", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: "Draft comment" }), " Or 1h?");
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Save your changes first?");

    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(within(elements.thread(1)).getByText("Why 24h?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveFocus();
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must let the user only discard or keep editing when they cleared a draft and start another comment", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(1)).getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Draft comment" }));

    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must close an editor with nothing unsaved when the user presses Escape", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("must ask about unsaved text, then keep editing, when the user presses Escape twice", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.keyboard("{Escape}");
    const question = screen.getByRole("alert");
    expect(question).toHaveTextContent("Save this comment?");
    expect(question).not.toHaveTextContent("You started");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
  });

  test("must keep the editor open when the user presses Escape to cancel an IME composition", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply" }), { isComposing: true, key: "Escape" });

    expect(screen.getByRole("textbox", { name: "Reply" })).toBeInTheDocument();
  });

  test("must save nothing when the user presses Cmd+Enter to commit an IME composition", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply" }), {
      isComposing: true,
      key: "Enter",
      metaKey: true,
    });

    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Hourly");
    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
  });

  test.each([
    { keys: "{Meta>}{Enter}{/Meta}", shortcut: "Cmd+Enter" },
    { keys: "{Control>}{Enter}{/Control}", shortcut: "Ctrl+Enter" },
  ])("must save the reply when the user presses $shortcut", async ({ keys }) => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await startReplyOnThread(user, 2, "Hourly");

    await user.keyboard(keys);

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
    expect(fake.snapshot.threads[1]?.draft?.body).toBe("Hourly");
  });

  test("must save nothing and keep the reply open when the user presses Cmd+Enter in an empty reply", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render();
    await user.click(within(elements.thread(2)).getByRole("button", { name: "Reply" }));

    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("");
    expect(fake.snapshot.threads[1]?.draft).toBeUndefined();
  });

  test("must tell the user how to save from the keyboard when they start a comment", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "New comment" }));
    await user.click(screen.getByRole("button", { name: "On the whole review" }));

    expect(within(screen.getByRole("region", { name: "New comment" })).getByText("to save")).toBeInTheDocument();
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
  let listed = shown;
  let selectedThreadId: number | null = null;
  let selectionCount = 0;
  const view = () => (
    <ReviewApiContext value={fake.api}>
      <CommentEditorHarness onChanged={onChanged} threads={listed}>
        {(editor) => (
          <ThreadSidebar
            closeButton={null}
            documentPath={documentPath}
            editor={editor}
            onChanged={onChanged}
            onSelectThread={onSelectThread}
            selectedThreadId={selectedThreadId}
            selectionCount={selectionCount}
            threads={listed}
          />
        )}
      </CommentEditorHarness>
    </ReviewApiContext>
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  const render = (): void => {
    rerenderBase = renderBase(view()).rerender;
  };
  const showThreads = (next: Thread[]): void => {
    listed = next;
    rerenderBase(view());
  };
  const select = (threadId: number | null): void => {
    selectedThreadId = threadId;
    selectionCount += 1;
    rerenderBase(view());
  };
  return { fake, onChanged, onSelectThread, render, select, showThreads };
}

async function discardDraftOnThread(
  user: ReturnType<typeof userEvent.setup>,
  threadId: number,
  confirmation: string
): Promise<void> {
  await user.click(within(elements.thread(threadId)).getByRole("button", { name: "Discard" }));
  await user.click(within(screen.getByRole("dialog", { name: confirmation })).getByRole("button", { name: "Discard" }));
}

async function startReplyOnThread(
  user: ReturnType<typeof userEvent.setup>,
  threadId: number,
  text: string
): Promise<void> {
  await user.click(within(elements.thread(threadId)).getByRole("button", { name: "Reply" }));
  await user.keyboard(text);
}

const elements = {
  groupTitles: (): string[] => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  thread: (id: number) => screen.getByRole("article", { name: `Thread #${id}` }),
  threadsIn: (group: string): string[] =>
    within(screen.getByRole("region", { name: group }))
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? ""),
};
