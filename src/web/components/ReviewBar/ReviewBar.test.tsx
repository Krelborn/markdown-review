import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";

import type { ReviewRound } from "../../../shared/review/reviewRoundSchema";
import { roundOutcome } from "../../../shared/review/roundOutcome";
import { buildPassageAnchor, buildRound, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
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

  test.each([
    { badge: "Going ahead", kind: "go-ahead" as const },
    { badge: "Handed back", kind: "hand-back" as const },
  ])("must show $badge when the user ended the round with $kind", ({ badge, kind }) => {
    const { render } = setUpTest();

    render({ round: buildRound({ verdict: { at: testTime, kind } }) });

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  test("must show no outcome when the user asked for revisions", () => {
    const { render } = setUpTest();

    render({ round: buildRound({ verdict: { at: testTime, kind: "revise" } }) });

    expect(screen.queryByText("Going ahead")).not.toBeInTheDocument();
    expect(screen.queryByText("Handed back")).not.toBeInTheDocument();
  });

  test("must offer Go ahead and Hand back to agent but not Revise when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(elements.submitDialog().getByText("You have no drafts.")).toBeInTheDocument();
    expect(elements.submitDialog().getByRole("radio", { name: "Revise" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("radio", { name: "Go ahead" })).toBeChecked();
    expect(elements.submitDialog().getByRole("radio", { name: "Hand back to agent" })).toBeEnabled();
  });

  test.each([
    {
      drafts: oneDraft,
      submit: "Submit 1 draft",
      verdict: "Revise",
      description: "Send your comments. The agent revises the docs, answers each one, and waits for you.",
    },
    {
      drafts: [],
      submit: "Submit",
      verdict: "Revise",
      description: "Send your comments. The agent revises the docs, answers each one, and waits for you.",
    },
    {
      drafts: oneDraft,
      submit: "Submit 1 draft",
      verdict: "Go ahead",
      description: "Send your comments and end the review. The agent addresses them, then carries on with its task.",
    },
    {
      drafts: [],
      submit: "Submit",
      verdict: "Go ahead",
      description: "End the review. The agent carries on with its task.",
    },
    {
      drafts: oneDraft,
      submit: "Submit 1 draft",
      verdict: "Hand back to agent",
      description: "Send your comments and end the review. The agent stops and waits for you in the chat.",
    },
    {
      drafts: [],
      submit: "Submit",
      verdict: "Hand back to agent",
      description: "End the review. The agent stops and waits for you in the chat.",
    },
  ])(
    "must say what $verdict does when the user opens the popover with $submit",
    async ({ description, drafts, submit, verdict }) => {
      const { render } = setUpTest();
      const user = userEvent.setup();
      render({ drafts });

      await user.click(screen.getByRole("button", { name: submit }));

      expect(elements.submitDialog().getByRole("radio", { name: verdict })).toHaveAccessibleDescription(description);
    }
  );

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

  test("must send the drafts to the agent when the user chooses Revise", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    expect(elements.submitDialog().getByRole("radio", { name: "Revise" })).toBeChecked();
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(roundOutcome(fake.snapshot.round)).toBeNull();
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test.each([
    { verdict: "Go ahead", outcome: "go-ahead" },
    { verdict: "Hand back to agent", outcome: "hand-back" },
  ])("must end the round with $outcome when the user chooses $verdict", async ({ outcome, verdict }) => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("radio", { name: verdict }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Submit" }));

    expect(fake.snapshot.threads).toMatchObject([{ status: "open" }]);
    expect(roundOutcome(fake.snapshot.round)).toBe(outcome);
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

  test("must not submit Revise when the drafts go while the user has it chosen", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    const { rerender } = render({ drafts: oneDraft });
    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    rerender({ drafts: [] });

    expect(elements.submitDialog().getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  test.each([
    { drafts: oneDraft, submit: "Submit 1 draft", verdict: "Revise" },
    { drafts: [], submit: "Submit", verdict: "Go ahead" },
  ])("must focus $verdict when the user opens the popover with $submit", async ({ drafts, submit, verdict }) => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts });

    await user.click(screen.getByRole("button", { name: submit }));

    expect(elements.submitDialog().getByRole("radio", { name: verdict })).toHaveFocus();
  });

  test("must focus Revise when the user opens the popover again after choosing Hand back to agent", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ drafts: oneDraft });
    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));
    await user.click(elements.submitDialog().getByRole("radio", { name: "Hand back to agent" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    expect(elements.submitDialog().getByRole("radio", { name: "Revise" })).toHaveFocus();
  });

  test("must focus Revise when the user opens the popover again after writing a draft", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    const { rerender } = render();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Cancel" }));
    rerender({ drafts: oneDraft });

    await user.click(screen.getByRole("button", { name: "Submit 1 draft" }));

    expect(elements.submitDialog().getByRole("radio", { name: "Revise" })).toHaveFocus();
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
  round?: ReviewRound | null;
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
    round = fake.snapshot.round,
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
        round={round}
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
