import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { TopBar } from "./TopBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

describe("TopBar", () => {
  test("must title the page with the doc's file name when a doc is on screen", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("heading", { level: 1, name: "plan.md" })).toBeInTheDocument();
  });

  test("must offer the doc's whole path on hover when a doc is on screen", () => {
    const { render } = setUpTest();

    render();

    expect(elements.documentButton()).toHaveAttribute("title", "docs/plan.md");
  });

  test("must title the page All docs when the docs list is on screen", () => {
    const { render } = setUpTest({ documentPath: null });

    render();

    expect(screen.getByRole("heading", { level: 1, name: "All docs" })).toBeInTheDocument();
  });

  test.each([
    { documentPath: "docs/plan.md", page: "a doc" },
    { documentPath: null, page: "the docs list" },
  ])("must offer the About button when $page is on screen", ({ documentPath }) => {
    const { render } = setUpTest({ documentPath });

    render();

    expect(within(screen.getByRole("banner")).getByRole("button", { name: "About Markdown Review" })).toBeVisible();
  });

  test("must show the docs list when the user clicks the app's icon", async () => {
    const { onNavigate, render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("link", { name: "Markdown Review: all docs" }));

    expect(onNavigate).toHaveBeenCalledWith("/");
  });

  test("must list docs with comments, then other recent docs, when the user opens the docs menu", async () => {
    const { render } = setUpTest({ recent: ["README.md", "docs/spec.md", "docs/plan.md"] });
    const user = userEvent.setup();
    render();

    await user.click(elements.documentButton());

    const docs = within(screen.getByRole("navigation", { name: "Docs" }));
    expect(await docs.findByRole("link", { name: "plan.md docs 0 open, 1 draft" })).toHaveAttribute(
      "href",
      "/document/docs/plan.md"
    );
    expect(docs.getByRole("link", { name: "README.md" })).toHaveAttribute("href", "/document/README.md");
    expect(docs.getByRole("link", { name: "spec.md docs" })).toHaveAttribute("href", "/document/docs/spec.md");
  });

  test("must mark the doc on screen when the user opens the docs menu", async () => {
    const { render } = setUpTest({ recent: ["docs/spec.md"] });
    const user = userEvent.setup();
    render();

    await user.click(elements.documentButton());

    expect(await screen.findByRole("link", { name: "plan.md docs 0 open, 1 draft" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "spec.md docs" })).not.toHaveAttribute("aria-current");
  });

  test("must show the chosen doc in the page when the user picks it from the docs menu", async () => {
    const { onNavigate, render } = setUpTest({ recent: ["docs/spec.md"] });
    const user = userEvent.setup();
    render();

    await user.click(elements.documentButton());
    await user.click(await screen.findByRole("link", { name: "spec.md docs" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md");
  });
});

function setUpTest({
  documentPath = "docs/plan.md",
  recent = [],
}: { documentPath?: string | null; recent?: string[] } = {}) {
  const fake = createFakeReviewApi({ recent, threads: [draftThread] });
  const onNavigate = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <TopBar documentPath={documentPath} onNavigate={onNavigate} />
      </ReviewApiContext>
    );
  };
  return { onNavigate, render };
}

const elements = {
  documentButton: () => screen.getByRole("button", { name: "plan.md" }),
};
