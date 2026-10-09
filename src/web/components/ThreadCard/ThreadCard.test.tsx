import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, onTestFinished, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { formatMessageTime } from "../../review/formatMessageTime";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadCard } from "./ThreadCard";

const conversation = buildThread({
  anchor: buildPassageAnchor(),
  messages: [
    { at: testTime, author: "user", body: "Why 24h?" },
    { at: "2026-10-08T09:05:00.000Z", author: "agent", body: "Upstream data changes daily." },
  ],
});

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
    const { render } = setUpTest({
      thread: buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" }),
    });

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

  test("must save the reply as a draft when the user replies", async () => {
    const { fake, onChanged, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save reply"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Hourly, then");
    expect(onChanged).toHaveBeenCalled();
  });

  test("must save the user's changes when the user edits a draft", async () => {
    const draft = buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" });
    const { fake, render } = setUpTest({ thread: draft });
    const user = userEvent.setup();
    render();

    await user.type(elements.textbox("Draft comment"), " And why cache?");
    await user.click(elements.button("Save draft"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h? And why cache?");
  });

  test("must delete a new comment when the user discards its draft", async () => {
    const draft = buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" });
    const { fake, render } = setUpTest({ thread: draft });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Discard draft"));

    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must resolve the thread when the user resolves it", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Resolve"));

    expect(fake.snapshot.threads[0]?.status).toBe("resolved");
  });

  test("must offer only a reply when the thread is already resolved", () => {
    const { render } = setUpTest({ thread: { ...conversation, status: "resolved" } });

    render();

    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });

  test("must show why and keep the text when the server refuses the reply", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save reply"));

    expect(await screen.findByRole("alert")).toHaveTextContent("review.json is not valid");
    expect(elements.textbox("Reply")).toHaveValue("Hourly, then");
  });

  test("must not let the user save a reply when it is blank", async () => {
    const { render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "   ");

    expect(elements.button("Save reply")).toBeDisabled();
  });

  test("must ask to show the thread in its doc when the user clicks where it is", async () => {
    const { onSelect, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("#1 Line 3"));

    expect(onSelect).toHaveBeenCalledWith(conversation);
  });

  test("must mark the thread when the agent has written since the user last viewed it", () => {
    const { render } = setUpTest({ hasNewAgentMessage: true, thread: conversation });

    render();

    expect(screen.getByText("New reply")).toBeInTheDocument();
  });
});

function setUpTest({ hasNewAgentMessage = false, thread }: { hasNewAgentMessage?: boolean; thread: Thread }) {
  const fake = createFakeReviewApi({ threads: [thread] });
  const onChanged = vi.fn();
  const onSelect = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ThreadCard
          hasNewAgentMessage={hasNewAgentMessage}
          isSelected={false}
          onChanged={onChanged}
          onSelect={onSelect}
          thread={thread}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onSelect, render };
}

const elements = {
  button: (name: string) => screen.getByRole("button", { name }),
  textbox: (name: string) => screen.getByRole("textbox", { name }),
};
