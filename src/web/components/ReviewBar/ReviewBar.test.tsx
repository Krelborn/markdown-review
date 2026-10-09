import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import type { DraftCount } from "../../review/countDraftsByDocument";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ReviewBar } from "./ReviewBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

const oneDraft: DraftCount[] = [{ count: 1, document: "docs/plan.md" }];

describe("ReviewBar", () => {
  test("must say the agent is listening when the agent has a poll open", () => {
    const { render } = setUpTest();

    render({ agentWaiting: true });

    expect(within(screen.getByRole("status")).getByText("Agent listening")).toBeInTheDocument();
  });

  test("must say the agent is not listening when the agent has no poll open", () => {
    const { render } = setUpTest();

    render();

    expect(within(screen.getByRole("status")).getByText("Agent not listening")).toBeInTheDocument();
  });

  test.each([
    { agentWaiting: true, explanation: "The agent is listening and will hear at once." },
    {
      agentWaiting: false,
      explanation: "The agent isn't listening. It will find this in its inbox when it next looks.",
    },
  ])(
    "must explain in the submit popover what the agent will do when its poll open state is $agentWaiting",
    async ({ agentWaiting, explanation }) => {
      const { render } = setUpTest();
      const user = userEvent.setup();
      render({ agentWaiting });

      await user.click(screen.getByRole("button", { name: "Submit" }));

      expect(elements.submitDialog().getByText(explanation)).toBeInTheDocument();
    }
  );

  test("must show the review as approved when the user approved this round", () => {
    const { render } = setUpTest();

    render({ review: { approved: true, approvedAt: testTime, requestedAt: testTime } });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  test("must offer only approval when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(elements.submitDialog().getByText("You have no drafts.")).toBeInTheDocument();
    expect(elements.submitDialog().getByRole("radio", { name: "Request changes" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("radio", { name: "Approve" })).toBeChecked();
  });

  test("must say how many drafts a submit sends, and which docs they are on", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({
      drafts: [
        { count: 1, document: null },
        { count: 2, document: "docs/plan.md" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Submit 3 drafts" }));

    expect(elements.submitDialog().getByText("Sends 3 drafts:")).toBeInTheDocument();
    expect(elements.submitDialog().getByText("Whole review 1")).toBeInTheDocument();
    expect(elements.submitDialog().getByText("plan.md 2")).toHaveAttribute("title", "docs/plan.md");
  });

  test("must send the drafts to the agent when the user requests changes", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    expect(elements.submitDialog().getByRole("radio", { name: "Request changes" })).toBeChecked();
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(fake.snapshot.review.approved).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("must approve the review when the user chooses Approve", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("radio", { name: "Approve" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.review.approved).toBe(true);
  });

  test("must show why when the server refuses the submit", async () => {
    const { fake, render } = setUpTest();
    fake.api.submit.mockRejectedValueOnce(new ReviewApiError(409, "invalid-state", "There are no drafts to submit"));
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(await elements.submitDialog().findByRole("alert")).toHaveTextContent("There are no drafts to submit");
  });

  test("must ask the user to save or discard their comment, and not submit, while they have unsaved text", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft, hasUnsavedText: true });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    expect(
      elements.submitDialog().getByText("Save or discard the comment you're writing before you submit.")
    ).toBeInTheDocument();
    expect(elements.submitDialog().getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  test("must not submit a request for changes when the drafts go while the user has it chosen", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    const { rerender } = render({ drafts: oneDraft });
    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    rerender({ drafts: [] });

    expect(elements.submitDialog().getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  test.each([
    { expanded: "false", isPanelOpen: false },
    { expanded: "true", isPanelOpen: true },
  ])(
    "must mark the Comments button expanded $expanded when the panel's open state is $isPanelOpen",
    ({ expanded, isPanelOpen }) => {
      const { render } = setUpTest();

      render({ isPanelOpen });

      expect(elements.panelToggle()).toHaveAttribute("aria-expanded", expanded);
    }
  );

  test("must ask to show or hide the comments when the user presses Comments", async () => {
    const { onTogglePanel, render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(elements.panelToggle());

    expect(onTogglePanel).toHaveBeenCalled();
  });
});

interface RenderOptions {
  agentWaiting?: boolean;
  drafts?: DraftCount[];
  hasUnsavedText?: boolean;
  isPanelOpen?: boolean;
  review?: ReviewState;
}

function setUpTest() {
  const fake = createFakeReviewApi({ threads: [draftThread] });
  const onSubmitted = vi.fn();
  const onTogglePanel = vi.fn();
  const view = ({
    agentWaiting = false,
    drafts = [],
    hasUnsavedText = false,
    isPanelOpen = false,
    review = fake.snapshot.review,
  }: RenderOptions = {}): JSX.Element => (
    <ReviewApiContext value={fake.api}>
      <ReviewBar
        agentWaiting={agentWaiting}
        drafts={drafts}
        hasUnsavedText={hasUnsavedText}
        isPanelOpen={isPanelOpen}
        onSubmitted={onSubmitted}
        onTogglePanel={onTogglePanel}
        panelId="comments-panel"
        panelToggleRef={createRef()}
        review={review}
      />
    </ReviewApiContext>
  );
  const render = (options?: RenderOptions) => {
    const { rerender } = renderBase(view(options));
    return { rerender: (next?: RenderOptions) => rerender(view(next)) };
  };
  return { fake, onSubmitted, onTogglePanel, render };
}

const elements = {
  panelToggle: () => screen.getByRole("button", { name: "Comments" }),
  submitDialog: () => within(screen.getByRole("dialog", { name: "Submit review" })),
};
