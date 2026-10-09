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
  test("must show the doc's path when a doc is on screen", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInTheDocument();
  });

  test("must list docs with comments, then other recent docs, when the user opens the docs menu", async () => {
    const { render } = setUpTest({ recent: ["docs/spec.md", "docs/plan.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));

    const docs = within(screen.getByRole("navigation", { name: "Docs" }));
    expect(await docs.findByRole("link", { name: "docs/plan.md 0 open, 1 draft" })).toHaveAttribute(
      "href",
      "/document/docs/plan.md"
    );
    expect(docs.getByRole("link", { name: "docs/spec.md" })).toHaveAttribute("href", "/document/docs/spec.md");
  });

  test("must show the chosen doc in the page when the user picks it from the docs menu", async () => {
    const { onNavigate, render } = setUpTest({ recent: ["docs/spec.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));
    await user.click(await screen.findByRole("link", { name: "docs/spec.md" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md");
  });
});

function setUpTest({ recent = [] }: { recent?: string[] } = {}) {
  const fake = createFakeReviewApi({ recent, threads: [draftThread] });
  const onNavigate = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <TopBar documentPath="docs/plan.md" onNavigate={onNavigate} />
      </ReviewApiContext>
    );
  };
  return { onNavigate, render };
}
