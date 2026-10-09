import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ReviewBar } from "./ReviewBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

describe("ReviewBar", () => {
  test("must say the agent is waiting when the agent has a poll open", () => {
    const { render } = setUpTest();

    render({ agentWaiting: true });

    expect(screen.getByRole("status")).toHaveTextContent("Agent waiting");
  });

  test("must say comments will wait in the inbox when the agent is not listening", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("status")).toHaveTextContent("Agent not listening, comments will wait in the inbox");
  });

  test("must show the review as approved when the user approved this round", () => {
    const { render } = setUpTest();

    render({ review: { approved: true, approvedAt: testTime, requestedAt: testTime } });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  test("must offer only approval when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 0 });

    await user.click(screen.getByRole("button", { name: "Submit (0)" }));

    expect(elements.submitDialog().getByRole("button", { name: "Request changes" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  test("must send the drafts to the agent when the user requests changes", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(fake.snapshot.review.approved).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("must approve the review when the user approves", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Approve" }));

    expect(fake.snapshot.review.approved).toBe(true);
  });

  test("must show why when the server refuses the submit", async () => {
    const { fake, render } = setUpTest();
    fake.api.submit.mockRejectedValueOnce(new ReviewApiError(409, "invalid-state", "There are no drafts to submit"));
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(await elements.submitDialog().findByRole("alert")).toHaveTextContent("There are no drafts to submit");
  });
});

interface RenderOptions {
  agentWaiting?: boolean;
  draftCount?: number;
  review?: ReviewState;
}

function setUpTest() {
  const fake = createFakeReviewApi({ threads: [draftThread] });
  const onSubmitted = vi.fn();
  const render = ({
    agentWaiting = false,
    draftCount = 0,
    review = fake.snapshot.review,
  }: RenderOptions = {}): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ReviewBar agentWaiting={agentWaiting} draftCount={draftCount} onSubmitted={onSubmitted} review={review} />
      </ReviewApiContext>
    );
  };
  return { fake, onSubmitted, render };
}

const elements = {
  submitDialog: () => within(screen.getByRole("dialog", { name: "Submit review" })),
};
