import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { App } from "./App";

const plan = "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n";

const spec = "# Spec\n\nResults are cached.\n";

const planAnchor = buildPassageAnchor({ endOffset: 29, startOffset: 8 });

const planThread = buildThread({ anchor: planAnchor, id: 1 });

const specThread = buildThread({
  anchor: buildPassageAnchor({
    anchoredText: "Results",
    document: "docs/spec.md",
    endOffset: 12,
    quote: "Results",
    startOffset: 5,
  }),
  id: 2,
});

describe("App", () => {
  test("must list the docs with comments when the page opens at its root", async () => {
    const { render } = setUpTest({ path: "/" });

    await render();

    expect(screen.getByRole("heading", { level: 1, name: "Docs" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "docs/plan.md 1 open, 0 drafts" })).toBeInTheDocument();
  });

  test("must show the doc and its threads when the page opens at the doc's address", async () => {
    const { render } = setUpTest();

    await render();

    expect(await elements.article().findByRole("heading", { level: 1, name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Thread #1" })).toBeInTheDocument();
  });

  test("must say the doc was not found when it no longer exists", async () => {
    const { render } = setUpTest({ path: "/document/docs/gone.md" });

    await render();

    expect(await screen.findByRole("alert")).toHaveTextContent("docs/gone.md was not found");
  });

  test("must show the doc the agent opens when the agent opens another doc", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });

    expect(await screen.findByRole("heading", { level: 1, name: "docs/spec.md" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/document/docs/spec.md");
  });

  test("must show a doc whose name has spaces and accents when the page opens at its address", async () => {
    const { render } = setUpTest({ path: "/document/docs/Design%20Notes%20caf%C3%A9.md" });

    await render();

    expect(await screen.findByRole("heading", { level: 1, name: "docs/Design Notes café.md" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Notes" })).toBeInTheDocument();
  });

  test("must show the doc the user came from when the user goes back", async () => {
    const { fake, render } = setUpTest();
    await render();
    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });
    await screen.findByRole("heading", { level: 1, name: "docs/spec.md" });

    history.back();

    expect(await screen.findByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInTheDocument();
  });

  test("must keep the user's unsent reply when the agent edits the doc and answers", async () => {
    const { documents, fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "Half written");

    documents["docs/plan.md"] = "# Plan\n\nWe cache results for 1h today.\n";
    fake.snapshot.threads[0]?.messages.push({ at: testTime, author: "agent", body: "Changed to 1h" });
    fake.emit({ document: "docs/plan.md", type: "document-changed" });
    fake.emit({ type: "threads-changed" });

    expect(await screen.findByText("Changed to 1h")).toBeInTheDocument();
    expect(await elements.article().findByText("We cache results for 1h today.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must keep the user's unsent reply when the agent resolves the thread", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");

    fake.snapshot.threads[0] = { ...planThread, status: "resolved" };
    fake.emit({ type: "threads-changed" });
    const resolved = within(await screen.findByRole("region", { name: "Resolved" }));
    await user.click(resolved.getByText("Resolved (1)"));

    expect(resolved.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must keep the user's unsent reply when an edit leaves its passage outdated", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");

    fake.snapshot.threads[0] = { ...planThread, anchor: { ...planAnchor, outdated: true } };
    fake.emit({ type: "threads-changed" });
    const outdated = within(await screen.findByRole("region", { name: "Outdated" }));

    expect(outdated.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must keep the user's unsent reply when the agent opens another doc and the user comes back", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await startReply(user, "Half written");

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });
    await screen.findByRole("heading", { level: 1, name: "docs/spec.md" });
    history.back();
    await screen.findByRole("heading", { level: 1, name: "docs/plan.md" });

    expect(await screen.findByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must show the agent's reply when the server says the threads changed", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.snapshot.threads[0]?.messages.push({ at: testTime, author: "agent", body: "Changed to 1h" });
    fake.emit({ type: "threads-changed" });

    expect(await screen.findByText("Changed to 1h")).toBeInTheDocument();
  });

  test("must show the new text in place when the agent edits the doc", async () => {
    const { documents, fake, render } = setUpTest();
    await render();

    documents["docs/plan.md"] = "# Plan\n\nWe cache results for 1h today.\n";
    fake.emit({ document: "docs/plan.md", type: "document-changed" });

    expect(await elements.article().findByText("We cache results for 1h today.")).toBeInTheDocument();
  });

  test("must say the server cannot be reached while the connection is down, and read everything again when it is back", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ type: "disconnected" });
    const alert = await screen.findByRole("alert");
    fake.snapshot.threads.push(buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 3 }));
    fake.emit({ type: "connected" });

    expect(alert).toHaveTextContent("Lost the connection to the review server");
    expect(await screen.findByRole("article", { name: "Thread #3" })).toBeInTheDocument();
    expect(screen.queryByText("Lost the connection to the review server")).not.toBeInTheDocument();
  });

  test("must show that the agent is waiting when the server says a poll is open", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ agentWaiting: true, type: "presence" });

    expect(await screen.findByText("Agent waiting")).toBeInTheDocument();
  });

  test("must count the drafts on every doc on the submit button", async () => {
    const { render } = setUpTest({
      threads: [
        planThread,
        { ...specThread, draft: { at: testTime, body: "Cached where?" } },
        buildThread({
          anchor: { kind: "review" },
          draft: { at: testTime, body: "Overall?" },
          id: 3,
          messages: [],
          status: "draft",
        }),
      ],
    });

    await render();

    expect(await screen.findByRole("button", { name: "Submit (2)" })).toBeInTheDocument();
  });

  test("must save a comment on the selected text as a draft when the user writes one", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    await render();
    await elements.article().findByText("Retries happen three times.");

    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));
    await user.keyboard("Three is too many");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    const drafts = within(await screen.findByRole("region", { name: "Drafts" }));
    expect(drafts.getByRole("article", { name: "Thread #1" })).toHaveTextContent("Retries");
    expect(await screen.findByRole("button", { name: "Submit (1)" })).toBeInTheDocument();
  });

  test("must show the thread's doc when the user selects a thread on another doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("radio", { name: "All docs" }));
    await user.click(screen.getByRole("button", { name: "#2 Line 3" }));

    expect(await screen.findByRole("heading", { level: 1, name: "docs/spec.md" })).toBeInTheDocument();
  });
});

function setUpTest({
  path = "/document/docs/plan.md",
  threads = [planThread, specThread],
}: { path?: string; threads?: Thread[] } = {}) {
  localStorage.clear();
  history.pushState(null, "", path);
  const documents: Record<string, string> = {
    "docs/Design Notes café.md": "# Notes\n",
    "docs/plan.md": plan,
    "docs/spec.md": spec,
  };
  const fake = createFakeReviewApi({ documents, threads });
  const render = async (): Promise<void> => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <App />
      </ReviewApiContext>
    );
    await screen.findByRole("textbox", { name: "Comment on the whole review" });
  };
  return { documents, fake, render };
}

async function startReply(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Reply" }));
  await user.type(screen.getByRole("textbox", { name: "Reply" }), text);
}

function selectText(element: HTMLElement, length: number): void {
  const text = element.firstChild ?? element;
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

const elements = {
  article: () => within(screen.getByRole("article", { name: "docs/plan.md" })),
};
