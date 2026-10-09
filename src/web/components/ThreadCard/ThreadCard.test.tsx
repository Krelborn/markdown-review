import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { formatMessageTime } from "../../review/formatMessageTime";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";
import { CommentEditorHarness } from "../../testing/CommentEditorHarness";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadCard } from "./ThreadCard";

const conversation = buildThread({
  anchor: buildPassageAnchor(),
  messages: [
    { at: testTime, author: "user", body: "Why 24h?" },
    { at: "2026-10-08T09:05:00.000Z", author: "agent", body: "Upstream data changes daily." },
  ],
});

const draftComment = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

const draftReply: Thread = { ...conversation, draft: { at: testTime, body: "Hourly, then" } };

describe("ThreadCard", () => {
  test("must show the passage, and who wrote each message, when the thread has a conversation", () => {
    const { render } = setUpTest({ thread: conversation });

    render();

    const [question, answer] = within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem");
    expect(screen.getByText("cache results for 24h")).toBeInTheDocument();
    expect(question).toHaveTextContent("You");
    expect(question).toHaveTextContent("Why 24h?");
    expect(answer).toHaveTextContent("Agent");
    expect(answer).toHaveTextContent("Upstream data changes daily.");
  });

  test("must show when each message was sent", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T12:00:00.000Z"), toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { render } = setUpTest({ thread: conversation });

    render();

    const sentAt = "2026-10-08T09:05:00.000Z";
    expect(screen.getByText(formatMessageTime(sentAt, new Date()))).toHaveAttribute("datetime", sentAt);
  });

  test("must mark a new comment as a draft when the user has not submitted it", () => {
    const { render } = setUpTest({ thread: draftComment });

    render();

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  test("must show the text the user chose as well when an edit moved the passage onto other text", () => {
    const { render } = setUpTest({
      thread: buildThread({ anchor: buildPassageAnchor({ anchoredText: "cache results for 1h" }) }),
    });

    render();

    expect(screen.getByText("Originally: cache results for 24h")).toBeInTheDocument();
  });

  test("must show a draft as text, with Edit and no text box, until the user edits it", () => {
    const { render } = setUpTest({ thread: draftComment });

    render();

    expect(screen.getByText("Why 24h?")).toBeInTheDocument();
    expect(elements.button("Edit")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("must show a draft reply after the messages, marked as a draft, when the user has one", () => {
    const { render } = setUpTest({ thread: draftReply });

    render();

    expect(screen.getByText("Hourly, then")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  test.each<{ buttons: string[]; condition: string; thread: Thread }>([
    { buttons: ["Edit"], condition: "a new comment is a draft", thread: draftComment },
    { buttons: ["Resolve", "Reply"], condition: "an open thread has no draft reply", thread: conversation },
    { buttons: ["Resolve", "Edit"], condition: "an open thread has a draft reply", thread: draftReply },
    {
      buttons: ["Reply"],
      condition: "a resolved thread has no draft reply",
      thread: { ...conversation, status: "resolved" },
    },
    {
      buttons: ["Edit"],
      condition: "a resolved thread has a draft reply",
      thread: { ...draftReply, status: "resolved" },
    },
  ])("must offer $buttons when $condition", ({ buttons, thread }) => {
    const { render } = setUpTest({ thread });

    render();

    expect(elements.actions()).toEqual(buttons);
  });

  test("must save the reply as a draft when the user replies", async () => {
    const { fake, onChanged, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Hourly, then");
    expect(onChanged).toHaveBeenCalled();
  });

  test("must save the user's changes when the user edits a draft", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Edit"));
    await user.type(elements.textbox("Draft comment"), " And why cache?");
    await user.click(elements.button("Save"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h? And why cache?");
  });

  test("must not let the user save a draft when its text is unchanged", async () => {
    const { render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Edit"));

    expect(elements.button("Save")).toBeDisabled();
  });

  test("must put the draft back as it was when the user cancels an edit", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));
    await user.type(elements.textbox("Draft comment"), " And why cache?");

    await user.click(elements.button("Cancel"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Why 24h?")).toBeInTheDocument();
    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h?");
  });

  test("must delete a new comment when the user discards its draft", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));

    await user.click(elements.button("Discard"));

    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must make the text box read-only when the user's reply is saving", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    fake.api.writeDraft.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly");

    await user.click(elements.button("Save"));

    expect(elements.textbox("Reply")).toHaveAttribute("readonly");
  });

  test("must keep the draft when the user discards it while their changes to it are saving", async () => {
    const { fake, render } = setUpTest({ thread: draftComment });
    fake.api.writeDraft.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));
    await user.type(elements.textbox("Draft comment"), " Really?");
    await user.click(elements.button("Save"));

    await user.click(elements.button("Discard"));

    expect(fake.snapshot.threads).toHaveLength(1);
  });

  test("must remove only the reply when the user discards a draft reply", async () => {
    const { fake, render } = setUpTest({ thread: draftReply });
    const user = userEvent.setup();
    render();
    await user.click(elements.button("Edit"));

    await user.click(elements.button("Discard"));

    expect(fake.snapshot.threads).toHaveLength(1);
    expect(fake.snapshot.threads[0]?.messages).toHaveLength(2);
    expect(fake.snapshot.threads[0]?.draft).toBeUndefined();
  });

  test("must resolve the thread when the user resolves it", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Resolve"));

    expect(fake.snapshot.threads[0]?.status).toBe("resolved");
  });

  test("must mark the thread resolved when it is resolved", () => {
    const { render } = setUpTest({ thread: { ...conversation, status: "resolved" } });

    render();

    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  test("must show why and keep the text when the server refuses the reply", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save"));

    expect(await screen.findByRole("alert")).toHaveTextContent("review.json is not valid");
    expect(elements.textbox("Reply")).toHaveValue("Hourly, then");
  });

  test("must not let the user save a reply when it is blank", async () => {
    const { render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "   ");

    expect(elements.button("Save")).toBeDisabled();
  });

  test("must ask to show the thread in its doc when the user clicks where it is", async () => {
    const { onSelect, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("#1 Line 3"));

    expect(onSelect).toHaveBeenCalledWith(conversation);
  });

  test("must ask to select a thread on the whole review when the user clicks where it is", async () => {
    const wholeReview = buildThread({ anchor: { kind: "review" } });
    const { onSelect, render } = setUpTest({ thread: wholeReview });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("#1 Whole review"));

    expect(onSelect).toHaveBeenCalledWith(wholeReview);
  });

  test("must mark the thread when the agent has written since the user last viewed it", () => {
    const { render } = setUpTest({ hasNewAgentMessage: true, thread: conversation });

    render();

    expect(screen.getByText("New reply")).toBeInTheDocument();
  });

  test("must report its thread as hovered when the pointer moves onto the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.hover(screen.getByRole("article"));

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });

  test("must report no hovered thread when the pointer leaves the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();
    await user.hover(screen.getByRole("article"));

    await user.unhover(screen.getByRole("article"));

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must report its thread as hovered when the keyboard focus moves into the card", async () => {
    const { onHoverThread, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.tab();

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });

  test("must report no hovered thread when the keyboard focus leaves the card it hovers", async () => {
    const { onHoverThread, render } = setUpTest({ hoveredThreadId: 1, thread: conversation });
    const user = userEvent.setup();
    render();
    await user.tab();

    await user.tab({ shift: true });

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must leave another thread hovered when the keyboard focus leaves the card", async () => {
    const { onHoverThread, render } = setUpTest({ hoveredThreadId: 2, thread: conversation });
    const user = userEvent.setup();
    render();
    await user.tab();

    await user.tab({ shift: true });

    expect(onHoverThread).not.toHaveBeenCalledWith(null);
  });
});

function setUpTest({
  hasNewAgentMessage = false,
  hoveredThreadId = null,
  thread,
}: {
  hasNewAgentMessage?: boolean;
  hoveredThreadId?: number | null;
  thread: Thread;
}) {
  const fake = createFakeReviewApi({ threads: [thread] });
  const onChanged = vi.fn();
  const onHoverThread = vi.fn();
  const onSelect = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <HoveredThreadContext value={{ hoveredThreadId, onHoverThread }}>
          <CommentEditorHarness onChanged={onChanged} threads={[thread]}>
            {() => (
              <ThreadCard
                hasNewAgentMessage={hasNewAgentMessage}
                isSelected={false}
                onChanged={onChanged}
                onSelect={onSelect}
                thread={thread}
              />
            )}
          </CommentEditorHarness>
        </HoveredThreadContext>
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onHoverThread, onSelect, render };
}

const elements = {
  actions: (): string[] =>
    within(screen.getByRole("article"))
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((name) => !name.startsWith("#")),
  button: (name: string) => screen.getByRole("button", { name }),
  textbox: (name: string) => screen.getByRole("textbox", { name }),
};
