import {
  act,
  fireEvent,
  render as renderBase,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { buildPassageAnchor, buildThread } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { AppearanceProvider } from "../../appearance/AppearanceProvider";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import { DocumentView } from "./DocumentView";
import {
  hoveredHighlightName,
  overlapHighlightName,
  pendingHighlightName,
  selectedHighlightName,
  threadsHighlightName,
} from "./useThreadHighlights";

const source = [
  "# Plan",
  "",
  "We cache results for **24h** today. See the [spec](spec.md#goals).",
  "",
  "## Goals",
  "",
  "Retries happen three times.",
  "",
].join("\n");

const plan: DocumentSource = { hash: "hash of the plan", path: "docs/plan.md", source };

/**
 * The plan with a paragraph added before its others, so each of them is a different block than before
 */
const revisedPlan: DocumentSource = {
  hash: "hash of the revised plan",
  path: "docs/plan.md",
  source: source.replace("# Plan\n", "# Plan\n\nA new first paragraph.\n"),
};

const cacheAnchor = buildPassageAnchor({ endOffset: 29, prefix: "Plan\nWe ", startOffset: 8 });

const retriesAnchor = buildPassageAnchor({ anchoredText: "Retries", endOffset: 64, quote: "Retries", startOffset: 57 });

const todayAnchor = buildPassageAnchor({
  anchoredText: "24h today",
  endOffset: 35,
  quote: "24h today",
  startOffset: 26,
});

/**
 * The plan's Goals heading and the paragraph under it, as a saved comment on both whole blocks has them
 */
const goalsAnchor = buildPassageAnchor({
  anchoredText: "Goals\nRetries happen three times.",
  endLine: 7,
  endOffset: 84,
  prefix: "ts for 24h today. See the spec.\n",
  quote: "Goals\nRetries happen three times.",
  startLine: 5,
  startOffset: 51,
});

/**
 * The plan's Goals heading and the paragraph under it, as a comment on both whole blocks has them
 */
const goalsPassage: NewPassageAnchor = {
  document: "docs/plan.md",
  endOffset: 84,
  kind: "passage",
  prefix: "ts for 24h today. See the spec.\n",
  quote: "Goals\nRetries happen three times.",
  startOffset: 51,
  suffix: "",
};

afterEach(() => {
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  Reflect.deleteProperty(document, "elementFromPoint");
  vi.restoreAllMocks();
});

describe("DocumentView", () => {
  test("must show the rendered doc when it opens", async () => {
    const { render } = setUpTest();

    await render();

    expect(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" })).toHaveAttribute("id", "goals");
  });

  test("must start a comment on the selected text when the user clicks Comment beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    selectText("cache", "24h");
    await user.click(await screen.findByRole("button", { name: "Comment" }));

    expect(onComment).toHaveBeenCalledWith({
      anchor: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: " today. See the spec.\nGoals\nRetr",
      },
      renderedHash: "hash of the plan",
    });
  });

  test("must label a selection comment with the hash of the rendering the text was selected in when the doc renders again", async () => {
    const { onComment, render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    selectText("cache", "24h");
    const comment = await screen.findByRole("button", { name: "Comment" });
    await rerender({
      hash: "hash of the plan with four retries",
      path: "docs/plan.md",
      source: source.replace("three", "four"),
    });
    await within(elements.article()).findByText("Retries happen four times.");

    await user.click(comment);

    expect(onComment).toHaveBeenCalledWith(expect.objectContaining({ renderedHash: "hash of the plan" }));
  });

  test("must start a comment on the whole block when the user presses + beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await user.click(screen.getByRole("button", { name: "Comment on this block" }));

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Retries happen three times." }) })
    );
  });

  test("must label a block comment with the hash of the rendering it was made on when a newer source is still rendering", async () => {
    const { onComment, render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    const rendering = rerender(revisedPlan);

    fireEvent.click(screen.getByRole("button", { name: "Comment on this block" }));
    await rendering;

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: expect.objectContaining({ quote: "Retries happen three times." }),
        renderedHash: "hash of the plan",
      })
    );
  });

  test("must frame the block when the pointer is on its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));

    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must stop framing the block when the pointer leaves its +", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const block = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(block);
    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));

    await user.hover(block);

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must name the + without a tooltip, which would cover the bracket lane or the comments' bars beside it", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await moveInGutter(user, 60);

    expect(screen.getByRole("button", { name: "Comment on this block" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip", { hidden: true })).not.toBeInTheDocument();
  });

  test("must keep the block framed when the pointer leaves the + while it has focus", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const block = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(block);
    await user.hover(screen.getByRole("button", { name: "Comment on this block" }));
    await tabToBlockButton(user);

    await user.hover(block);

    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must keep focus on the + when the pointer moves over another block", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);

    await user.hover(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" }));

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveFocus();
  });

  test("must keep the + and its frame when the pointer leaves the doc while the + has focus", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);

    await user.hover(document.body);

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveFocus();
    expect(screen.getByTestId("block-target")).toBeInTheDocument();
  });

  test("must take the + away when the doc changes under the pointer", async () => {
    const { render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));

    await rerender(revisedPlan);
    await within(elements.article()).findByText("A new first paragraph.");

    expect(screen.queryByRole("button", { name: "Comment on this block" })).not.toBeInTheDocument();
  });

  test("must take a focused + away when the doc changes after the pointer has left", async () => {
    const { render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);
    await user.hover(document.body);

    await rerender(revisedPlan);
    await within(elements.article()).findByText("A new first paragraph.");

    expect(screen.queryByRole("button", { name: "Comment on this block" })).not.toBeInTheDocument();
  });

  test("must not frame a block when the pointer comes back after the doc changed under a focused +", async () => {
    const { render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await tabToBlockButton(user);
    await user.hover(document.body);
    await rerender(revisedPlan);

    await user.hover(await within(elements.article()).findByText("A new first paragraph."));

    expect(screen.getByRole("button", { name: "Comment on this block" })).toBeInTheDocument();
    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must move the + with its block when the layout moves the block under the pointer", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(text);
    moveBlockOf(text, 200);

    resizes.resize();

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "212px" });
  });

  test("must move a focused + with its block when the layout moves the block after the pointer has left", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("Retries happen three times.");
    await user.hover(text);
    await tabToBlockButton(user);
    await user.hover(document.body);
    moveBlockOf(text, 200);

    resizes.resize();

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "212px" });
  });

  test("must put the + beside the block level with the pointer when the pointer moves down the gutter", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await user.pointer({ coords: { clientX: 10, clientY: 150 }, target: elements.gutter() });

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "152px" });
  });

  test("must frame the block level with the pointer when the pointer is in the gutter", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await user.pointer({ coords: { clientX: 10, clientY: 60 }, target: elements.gutter() });

    expect(screen.getByTestId("block-target")).toHaveStyle({ top: "48px" });
  });

  test("must stop framing the block when the pointer leaves the gutter for the doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await user.pointer({ coords: { clientX: 10, clientY: 150 }, target: elements.gutter() });

    await user.pointer({
      coords: { clientX: 100, clientY: 150 },
      target: within(elements.article()).getByText("Retries happen three times."),
    });

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must start a comment on the block level with the pointer when the user clicks the gutter beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    const coords = { clientX: 10, clientY: 60 };

    await user.pointer([
      { coords, target: elements.gutter() },
      { coords, keys: "[MouseLeft]", target: elements.gutter() },
    ]);

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: expect.objectContaining({ quote: "We cache results for 24h today. See the spec." }),
      })
    );
  });

  test.each([
    { direction: "down", from: 60, to: 150 },
    { direction: "up", from: 150, to: 60 },
  ])(
    "must start a comment on every block from the first to the last when the user drags $direction the gutter",
    async ({ from, to }) => {
      const { onComment, render } = setUpTest();
      const user = userEvent.setup();
      await render();
      layOutBlocks();

      await pressGutter(user, from);
      await moveInGutter(user, to);
      await releaseGutter(user);

      expect(onComment).toHaveBeenCalledExactlyOnceWith({
        anchor: expect.objectContaining({
          quote: "We cache results for 24h today. See the spec.\nGoals\nRetries happen three times.",
        }),
        renderedHash: "hash of the plan",
      });
    }
  );

  test("must start one comment, on the blocks the drag covers, when the user holds ⌥ only as they end a drag down the gutter", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await pressGutter(user, 60);
    await moveInGutter(user, 150);

    await user.keyboard("{Alt>}");
    await releaseGutter(user);
    await user.keyboard("{/Alt}");

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        anchor: expect.objectContaining({
          quote: "We cache results for 24h today. See the spec.\nGoals\nRetries happen three times.",
        }),
      })
    );
  });

  test("must start a comment on one block when the user releases a drag on the block it started on", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await pressGutter(user, 60);
    await moveInGutter(user, 150);
    await moveInGutter(user, 70);
    await releaseGutter(user);

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        anchor: expect.objectContaining({ quote: "We cache results for 24h today. See the spec." }),
      })
    );
  });

  test("must start a comment on every block from the first to the last when the user drags from the +", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await moveInGutter(user, 60);
    const button = screen.getByRole("button", { name: "Comment on this block" });

    await user.pointer({ coords: { clientX: 20, clientY: 60 }, keys: "[MouseLeft>]", target: button });
    await moveInGutter(user, 150);
    await user.pointer({ coords: { clientX: 20, clientY: 150 }, keys: "[/MouseLeft]", target: button });

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        anchor: expect.objectContaining({
          quote: "We cache results for 24h today. See the spec.\nGoals\nRetries happen three times.",
        }),
      })
    );
  });

  test("must start one comment on the block when the user clicks the + while the gutter picks the block", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await moveInGutter(user, 60);

    await user.pointer({
      coords: { clientX: 20, clientY: 60 },
      keys: "[MouseLeft]",
      target: screen.getByRole("button", { name: "Comment on this block" }),
    });

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        anchor: expect.objectContaining({ quote: "We cache results for 24h today. See the spec." }),
      })
    );
  });

  test("must frame every block the drag covers, and say how many, while the user drags down the gutter", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await pressGutter(user, 60);
    await moveInGutter(user, 150);

    expect(screen.getByTestId("block-target")).toHaveStyle({ height: "122px", top: "48px" });
    expect(screen.getByTestId("block-target")).toHaveTextContent("3 blocks");
  });

  test("must put the + beside the block level with the pointer when the user ends a drag", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await pressGutter(user, 60);
    await moveInGutter(user, 150);

    await releaseGutter(user);

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "152px" });
  });

  test.each([
    { block: "a heading", clientY: 110, height: "78px", top: "90px" },
    { block: "a paragraph under a heading", clientY: 60, height: "172px", top: "-4px" },
  ])(
    "must bracket the heading's section beside the gutter when the pointer is level with $block",
    async ({ clientY, height, top }) => {
      const { render } = setUpTest();
      const user = userEvent.setup();
      await render();
      layOutBlocks();

      await moveInGutter(user, clientY);

      expect(screen.getByTestId("structure-bracket")).toHaveStyle({ height, top });
    }
  );

  test.each([
    { block: "its heading", clientY: 110, quote: "Goals\nRetries happen three times." },
    {
      block: "a paragraph under its heading",
      clientY: 60,
      quote: "Plan\nWe cache results for 24h today. See the spec.\nGoals\nRetries happen three times.",
    },
  ])(
    "must start a comment on the whole section when the user clicks the bracket lane beside $block",
    async ({ clientY, quote }) => {
      const { onComment, render } = setUpTest();
      const user = userEvent.setup();
      await render();
      layOutBlocks();
      const coords = { clientX: 4, clientY };

      await user.pointer([
        { coords, target: elements.bracketLane() },
        { coords, keys: "[MouseLeft]", target: elements.bracketLane() },
      ]);

      expect(onComment).toHaveBeenCalledExactlyOnceWith({
        anchor: expect.objectContaining({ quote }),
        renderedHash: "hash of the plan",
      });
    }
  );

  test("must start a comment on the structure level with the pointer when the doc scrolls under the pointer in the bracket lane", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    const coords = { clientX: 4, clientY: 60 };
    await user.pointer({ coords, target: elements.bracketLane() });
    Object.assign(document, { elementFromPoint: () => elements.bracketLane() });

    layOutBlocks(50);
    fireEvent.scroll(document);
    await user.pointer({ coords, keys: "[MouseLeft]", target: elements.bracketLane() });

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Goals\nRetries happen three times." }) })
    );
  });

  test("must frame the structure and name it when the pointer is in the bracket lane", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await user.pointer({ coords: { clientX: 4, clientY: 110 }, target: elements.bracketLane() });

    expect(screen.getByTestId("block-target")).toHaveStyle({ height: "82px", top: "88px" });
    expect(screen.getByTestId("block-target")).toHaveTextContent("Comment on the section “Goals”");
  });

  test.each([
    { control: "the gutter beside its heading", target: () => elements.gutter() },
    {
      control: "the + beside its heading",
      target: () => screen.getByRole("button", { name: "Comment on this block" }),
    },
  ])("must start a comment on the whole section when the user ⌥-clicks $control", async ({ target }) => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await moveInGutter(user, 110);
    const coords = { clientX: 20, clientY: 110 };

    await user.keyboard("{Alt>}");
    await user.pointer({ coords, keys: "[MouseLeft]", target: target() });
    await user.keyboard("{/Alt}");

    expect(onComment).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Goals\nRetries happen three times." }) })
    );
  });

  test("must frame the structure while the user holds ⌥ with the pointer in the gutter, and the block once they let go", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await moveInGutter(user, 110);

    await user.keyboard("{Alt>}");
    const whileHeld = screen.getByTestId("block-target").textContent;
    await user.keyboard("{/Alt}");

    expect(whileHeld).toBe("Comment on the section “Goals”");
    expect(screen.getByTestId("block-target")).toHaveTextContent("");
  });

  test("must not bracket a structure while the pointer is over the doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await user.pointer({
      coords: { clientX: 100, clientY: 150 },
      target: within(elements.article()).getByText("Retries happen three times."),
    });

    expect(screen.queryByTestId("structure-bracket")).not.toBeInTheDocument();
  });

  test("must start no comment when the user presses Escape during a drag", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await pressGutter(user, 60);
    await moveInGutter(user, 150);

    await user.keyboard("{Escape}");
    await releaseGutter(user);

    expect(onComment).not.toHaveBeenCalled();
    expect(screen.queryByText("3 blocks")).not.toBeInTheDocument();
  });

  test("must start no comment when the doc renders again during a drag", async () => {
    const { onComment, render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await pressGutter(user, 60);

    await rerender(revisedPlan);
    await releaseGutter(user);

    expect(onComment).not.toHaveBeenCalled();
  });

  test.each([
    { condition: "a comment is being written on other blocks", options: { pendingPassage: goalsPassage } },
    {
      condition: "the user points at a comment on other blocks in the comments",
      options: { hoveredThreadId: 5, threads: [buildThread({ anchor: goalsAnchor, id: 5 })] },
    },
    {
      condition: "the user has selected a comment on other blocks",
      options: { selectedThreadId: 5, threads: [buildThread({ anchor: goalsAnchor, id: 5 })] },
    },
  ])(
    "must frame only the blocks the drag covers while the user drags down the gutter when $condition",
    async ({ options }) => {
      const { render } = setUpTest(options);
      const user = userEvent.setup();
      await render();
      layOutBlocks();

      await pressGutter(user, 10);
      await moveInGutter(user, 60);

      expect(screen.getAllByTestId("block-target").map(({ textContent }) => textContent)).toEqual(["2 blocks"]);
    }
  );

  test("must keep the frame, rather than draw it again and fade it in, when the user clicks the gutter beside the block a comment is being written on", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 84,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries happen three times.",
        startOffset: 57,
        suffix: "",
      },
    });
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    const frame = screen.getByTestId("block-target");

    await pressGutter(user, 150);
    const framesWhilePressed = screen.getAllByTestId("block-target");
    await releaseGutter(user);

    expect(framesWhilePressed).toEqual([frame]);
    expect(screen.getAllByTestId("block-target")).toEqual([frame]);
  });

  test("must frame the blocks a comment is being written on again when the user presses Escape during a drag", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest({ pendingPassage: goalsPassage });
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    resizes.resize();
    await pressGutter(user, 10);
    await moveInGutter(user, 60);

    await user.keyboard("{Escape}");

    expect(screen.getAllByTestId("block-target").map((frame) => frame.style.top)).toContain("88px");
  });

  test("must hide the highlight of the passage a comment is being written on while the user drags down the gutter", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 64,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries",
        startOffset: 57,
        suffix: " happen three times.",
      },
    });
    const user = userEvent.setup();
    await render();
    layOutBlocks();

    await pressGutter(user, 10);
    await moveInGutter(user, 60);

    expect(elements.highlighted(pendingHighlightName)).toEqual([]);
  });

  test("must move the + to the block level with the pointer when the pointer is over the doc but between blocks", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await user.pointer({
      coords: { clientX: 100, clientY: 150 },
      target: within(elements.article()).getByText("Retries happen three times."),
    });

    await user.pointer({ coords: { clientX: 300, clientY: 90 }, target: elements.article() });
    await tabToBlockButton(user);
    await user.keyboard("{Enter}");

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Goals" }) })
    );
  });

  test("must move the + to the block level with the pointer when the pointer moves right of the doc onto a marker", async () => {
    const { render } = setUpTest({ threads: [buildThread({ anchor: retriesAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    await user.pointer({
      coords: { clientX: 100, clientY: 150 },
      target: within(elements.article()).getByText("Retries happen three times."),
    });

    await user.pointer({
      coords: { clientX: 660, clientY: 60 },
      target: screen.getByRole("button", { name: "Thread #1" }),
    });

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "66px" });
  });

  test("must keep the block framed when the user writes a comment on the whole of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 84,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries happen three times.",
        startOffset: 57,
        suffix: "",
      },
    });

    await render();

    expect(await screen.findByTestId("block-target")).toBeInTheDocument();
  });

  test("must not frame a block when the user writes a comment on part of it", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 64,
        kind: "passage",
        prefix: "Goals\n",
        quote: "Retries",
        startOffset: 57,
        suffix: " happen three times.",
      },
    });

    await render();

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must keep the blocks framed when the user writes a comment on several whole blocks", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest({ pendingPassage: goalsPassage });
    await render();
    layOutBlocks();

    resizes.resize();

    expect(screen.getByTestId("block-target")).toHaveStyle({
      height: "82px",
      left: "36px",
      top: "88px",
      width: "608px",
    });
  });

  test("must not paint the pending highlight when the user writes a comment on several whole blocks", async () => {
    const { render } = setUpTest({ pendingPassage: goalsPassage });

    await render();

    expect(elements.highlighted(pendingHighlightName)).toEqual([]);
  });

  test("must highlight open and draft passages, and the selected thread's apart, but not resolved or outdated ones", async () => {
    const { render } = setUpTest({
      selectedThreadId: 2,
      threads: [
        buildThread({ anchor: cacheAnchor, id: 1 }),
        buildThread({ anchor: retriesAnchor, id: 2 }),
        buildThread({ anchor: retriesAnchor, id: 3, status: "resolved" }),
        buildThread({ anchor: { ...cacheAnchor, outdated: true }, id: 4 }),
      ],
    });

    await render();

    expect(elements.highlighted(threadsHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(selectedHighlightName)).toEqual(["Retries"]);
    expect(screen.getAllByRole("button", { name: /^Thread #/ }).map((marker) => marker.textContent)).toEqual([
      "1",
      "2",
    ]);
  });

  test("must highlight the passage of the comment the user is writing", async () => {
    const { render } = setUpTest({
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
    });

    await render();

    expect(elements.highlighted(pendingHighlightName)).toEqual(["cache results for 24h"]);
  });

  test("must deepen the highlight when two threads' passages overlap", async () => {
    const { render } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: todayAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(overlapHighlightName)).toEqual(["24h"]);
  });

  test("must select a thread when the user clicks its marker", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "Thread #1" }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must select a thread when the user clicks its highlighted text", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("We cache results for", { exact: false }).firstChild;
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: text }) });

    await user.click(within(elements.article()).getByText("We cache results for", { exact: false }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must report the thread of a highlight when the pointer moves over it", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });

    await user.hover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
  });

  test("must report no hovered thread when the pointer leaves the doc", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await user.unhover(passage);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the pointer moves off a highlight after its thread is selected", async () => {
    const { onHoverThread, render, rerender } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
    await rerender(plan, { selectedThreadId: 1 });
    const plainText = within(elements.article()).getByText("Retries happen three times.");
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 0, offsetNode: plainText.firstChild }) });

    await user.hover(plainText);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the last highlighted thread goes away while the pointer is on it", async () => {
    const { onHoverThread, render, rerender } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await rerender(plan, { threads: [] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the thread under the pointer goes away while another stays highlighted", async () => {
    const retries = buildThread({ anchor: retriesAnchor, id: 2 });
    const { onHoverThread, render, rerender } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), retries],
    });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await rerender(plan, { threads: [retries] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the thread under the pointer moves to another passage", async () => {
    const { onHoverThread, render, rerender } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    await rerender(plan, { threads: [buildThread({ anchor: retriesAnchor, id: 1 })] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report the thread under a still pointer when a highlight appears under it", async () => {
    const { onHoverThread, render, rerender } = setUpTest();
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);

    await rerender(plan, { threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
  });

  test("must report no hovered thread when the doc's layout moves the thread away from a still pointer", async () => {
    const resizes = standInForResizes();
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
    const heading = within(elements.article()).getByRole("heading", { level: 1, name: "Plan" });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 0, offsetNode: heading.firstChild }) });

    resizes.resize();

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the doc scrolls the thread away from a still pointer", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));
    const heading = within(elements.article()).getByRole("heading", { level: 1, name: "Plan" });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 0, offsetNode: heading.firstChild }) });

    fireEvent.scroll(document);

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the doc goes away while the pointer is on a highlight", async () => {
    const { onHoverThread, render, unmount } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const passage = within(elements.article()).getByText("We cache results for", { exact: false });
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: passage.firstChild }) });
    await user.hover(passage);
    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(1));

    unmount();

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must not look for a highlight under the pointer when the doc has no highlighted threads", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    const caretPositionFromPoint = vi.fn();
    Object.assign(document, { caretPositionFromPoint });
    await render();

    await user.hover(within(elements.article()).getByText("We cache results for", { exact: false }));
    await new Promise(requestAnimationFrame);

    expect(caretPositionFromPoint).not.toHaveBeenCalled();
  });

  test("must draw a bar beside the blocks of a comment on several whole blocks", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });
    await render();
    layOutBlocks();

    resizes.resize();

    expect(screen.getByTestId("thread-bar")).toHaveStyle({ height: "82px", top: "88px" });
  });

  test("must draw each bar over the longer bars when three comments on whole blocks share a block", async () => {
    const resizes = standInForResizes();
    const wholePlan = "Plan\nWe cache results for 24h today. See the spec.\nGoals\nRetries happen three times.";
    const { render } = setUpTest({
      threads: [
        buildThread({ anchor: goalsAnchor, id: 5 }),
        buildThread({
          anchor: buildPassageAnchor({ anchoredText: wholePlan, endOffset: 84, quote: wholePlan, startOffset: 0 }),
          id: 6,
        }),
        buildThread({
          anchor: buildPassageAnchor({
            anchoredText: wholePlan.slice(5, 56),
            endOffset: 56,
            quote: wholePlan.slice(5, 56),
            startOffset: 5,
          }),
          id: 7,
        }),
      ],
    });
    await render();
    layOutBlocks();

    resizes.resize();

    expect(screen.getAllByTestId("thread-bar").map((bar) => bar.style.height)).toEqual(["176px", "90px", "82px"]);
  });

  test("must select a comment on several whole blocks when the user clicks its bar", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByTestId("thread-bar"));

    expect(onSelectThread).toHaveBeenCalledWith(5);
  });

  test("must report a comment on several whole blocks as hovered when the pointer is on its bar", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });
    const user = userEvent.setup();
    await render();

    await user.hover(screen.getByTestId("thread-bar"));

    expect(onHoverThread).toHaveBeenLastCalledWith(5);
  });

  test.each([
    { condition: "the user points at it in the comments", hoveredThreadId: 5, selectedThreadId: null },
    { condition: "the user selects it", hoveredThreadId: null, selectedThreadId: 5 },
  ])(
    "must frame the blocks of a comment on several whole blocks when $condition",
    async ({ hoveredThreadId, selectedThreadId }) => {
      const resizes = standInForResizes();
      const { render } = setUpTest({
        hoveredThreadId,
        selectedThreadId,
        threads: [buildThread({ anchor: goalsAnchor, id: 5 })],
      });
      await render();
      layOutBlocks();

      resizes.resize();

      expect(screen.getByTestId("block-target")).toHaveStyle({ height: "82px", top: "88px" });
    }
  );

  test("must not paint a comment on several whole blocks, but keep its marker", async () => {
    const { render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });

    await render();

    expect(elements.highlighted(threadsHighlightName)).toEqual([]);
    expect(elements.markers()).toEqual(["Thread #5"]);
  });

  test("must not deepen another comment's highlight inside a comment on several whole blocks", async () => {
    const { render } = setUpTest({
      threads: [buildThread({ anchor: goalsAnchor, id: 5 }), buildThread({ anchor: retriesAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(threadsHighlightName)).toEqual(["Retries"]);
    expect(elements.highlighted(overlapHighlightName)).toEqual([]);
  });

  test("must not select a comment on several whole blocks when the user clicks its text", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("Retries happen three times.").firstChild;
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 3, offsetNode: text }) });

    await user.click(within(elements.article()).getByText("Retries happen three times."));

    expect(onSelectThread).not.toHaveBeenCalled();
  });

  test("must pick no block when the pointer moves from the gutter onto a comment's bar", async () => {
    const resizes = standInForResizes();
    const { render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });
    const user = userEvent.setup();
    await render();
    layOutBlocks();
    resizes.resize();
    await moveInGutter(user, 60);

    await user.pointer({ coords: { clientX: 30, clientY: 150 }, target: screen.getByTestId("thread-bar") });

    expect(screen.getByRole("button", { name: "Comment on this block" })).toHaveStyle({ top: "66px" });
    expect(screen.queryByTestId("structure-bracket")).not.toBeInTheDocument();
  });

  test("must not frame the blocks of a comment on several whole blocks while nobody points at it or selects it", async () => {
    const { render } = setUpTest({ threads: [buildThread({ anchor: goalsAnchor, id: 5 })] });

    await render();

    expect(screen.queryByTestId("block-target")).not.toBeInTheDocument();
  });

  test("must emphasise the passage of a thread when the user points at it in the comments", async () => {
    const { render } = setUpTest({
      hoveredThreadId: 1,
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), buildThread({ anchor: retriesAnchor, id: 2 })],
    });

    await render();

    expect(elements.highlighted(hoveredHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(threadsHighlightName)).toEqual(["Retries"]);
  });

  test("must report a thread as hovered when the pointer is over its marker", async () => {
    const { onHoverThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    expect(onHoverThread).toHaveBeenLastCalledWith(1);
  });

  test("must report no hovered thread when the marker under the pointer goes away", async () => {
    const retries = buildThread({ anchor: retriesAnchor, id: 2 });
    const { onHoverThread, render, rerender } = setUpTest({
      threads: [buildThread({ anchor: cacheAnchor, id: 1 }), retries],
    });
    const user = userEvent.setup();
    await render();
    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    await rerender(plan, { threads: [retries] });

    await waitFor(() => expect(onHoverThread).toHaveBeenLastCalledWith(null));
  });

  test("must report no hovered thread when the doc goes away while the pointer is on a marker", async () => {
    const { onHoverThread, render, unmount } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    await user.hover(screen.getByRole("button", { name: "Thread #1" }));

    unmount();

    expect(onHoverThread).toHaveBeenLastCalledWith(null);
  });

  test("must paint each kind of highlight over the kinds before it when the doc has every kind", async () => {
    const { render } = setUpTest({
      hoveredThreadId: 3,
      pendingPassage: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
      selectedThreadId: 4,
      threads: [
        buildThread({ anchor: cacheAnchor, id: 1 }),
        buildThread({ anchor: todayAnchor, id: 2 }),
        buildThread({ anchor: retriesAnchor, id: 3 }),
        buildThread({ anchor: retriesAnchor, id: 4 }),
      ],
    });

    await render();

    expect(elements.priority(overlapHighlightName)).toBeGreaterThan(elements.priority(threadsHighlightName));
    expect(elements.priority(hoveredHighlightName)).toBeGreaterThan(elements.priority(overlapHighlightName));
    expect(elements.priority(selectedHighlightName)).toBeGreaterThan(elements.priority(hoveredHighlightName));
    expect(elements.priority(pendingHighlightName)).toBeGreaterThan(elements.priority(selectedHighlightName));
  });

  test("must show a linked doc in the page when the user follows a link to it", async () => {
    const { onNavigate, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "spec" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md#goals");
  });

  test("must copy the page's address, holding the heading, when the user clicks a heading's link", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
    expect(await navigator.clipboard.readText()).toBe(location.href);
  });

  test("must still put the heading in the address when the browser refuses the copy", async () => {
    onTestFinished(() => history.replaceState(null, "", "/"));
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("Denied", "NotAllowedError"));

    await user.click(within(elements.article()).getByRole("link", { name: "Link to Goals" }));

    expect(location.hash).toBe("#goals");
  });

  test("must stop offering Comment when the user selects text outside the doc", async () => {
    const { render } = setUpTest();
    await render();
    const outside = document.createElement("p");
    outside.textContent = "Sidebar text";
    document.body.append(outside);
    selectText("cache", "24h");
    const comment = await screen.findByRole("button", { name: "Comment" });

    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    await waitForElementToBeRemoved(comment);
  });

  test("must scroll to the heading the address names once, and keep the user's place when the doc changes", async () => {
    const scrolledTo: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
      scrolledTo.push(this.id);
    });
    const { render, rerender } = setUpTest({ hash: "#goals" });
    await render();
    await waitFor(() => expect(scrolledTo).toEqual(["goals"]));

    await rerender({ ...plan, source: `${source}\nAnother paragraph.\n` });

    expect(await within(elements.article()).findByText("Another paragraph.")).toBeInTheDocument();
    expect(scrolledTo).toEqual(["goals"]);
  });

  test("must keep showing the doc when the address names a heading with a malformed escape", async () => {
    const { render } = setUpTest({ hash: "#%E0%A4%A" });

    await render();

    expect(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" })).toBeInTheDocument();
  });

  test("must scroll to the doc's heading when the app's page has an element with the same id", async () => {
    const appRoot = document.createElement("div");
    appRoot.id = "goals";
    document.body.prepend(appRoot);
    onTestFinished(() => appRoot.remove());
    const scrolledTo: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
      scrolledTo.push(`${this.tagName}#${this.id}`);
    });
    const { render } = setUpTest({ hash: "#goals" });

    await render();

    await waitFor(() => expect(scrolledTo).toEqual(["H2#goals"]));
  });

  test.each([
    { passageTop: 40, side: "above" },
    { passageTop: 600, side: "below" },
  ])(
    "must scroll the selected thread's passage into view when it lies $side the box the doc scrolls in",
    async ({ passageTop }) => {
      const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop });

      await render();

      await waitFor(() => expect(scrolledTo).toEqual(["P"]));
    }
  );

  test("must leave the doc where it is when the selected thread's passage lies inside the box the doc scrolls in", async () => {
    const { render, scrolledTo } = setUpTestWithScrollContainer({ passageTop: 200 });

    await render();
    await screen.findByRole("button", { name: "Thread #1" });

    expect(scrolledTo).toEqual([]);
  });

  test("must show the new text in place when the doc's source changes", async () => {
    const { render, rerender } = setUpTest();
    await render();

    await rerender({ ...plan, source: "# Plan\n\nWe cache results for 1h today.\n" });

    expect(await within(elements.article()).findByText("We cache results for 1h today.")).toBeInTheDocument();
    expect(within(elements.article()).queryByText("Retries happen three times.")).not.toBeInTheDocument();
  });
});

interface SetUpOptions {
  container?: HTMLElement;
  hash?: string;
  hoveredThreadId?: number | null;
  pendingPassage?: NewPassageAnchor | null;
  selectedThreadId?: number | null;
  threads?: Thread[];
}

function setUpTest({
  container,
  hash = "",
  hoveredThreadId = null,
  pendingPassage = null,
  selectedThreadId = null,
  threads = [],
}: SetUpOptions = {}) {
  const onComment = vi.fn();
  const onHoverThread = vi.fn();
  const onNavigate = vi.fn();
  const onSelectThread = vi.fn();
  const view = (shown: DocumentSource, shownSelectedThreadId: number | null, shownThreads: Thread[]) => (
    <AppearanceProvider>
      <HoveredThreadContext value={{ hoveredThreadId, onFocusThread: () => {}, onHoverThread }}>
        <DocumentView
          document={shown}
          hash={hash}
          onComment={onComment}
          onNavigate={onNavigate}
          onSelectThread={onSelectThread}
          pendingPassage={pendingPassage}
          revealCount={0}
          selectedThreadId={shownSelectedThreadId}
          threads={shownThreads}
        />
      </HoveredThreadContext>
    </AppearanceProvider>
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  let unmount: () => void = () => {};
  const render = async (shown = plan): Promise<void> => {
    ({ rerender: rerenderBase, unmount } = renderBase(view(shown, selectedThreadId, threads), { container }));
    if (shown.source !== "") {
      await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
    }
  };
  const rerender = async (
    shown: DocumentSource,
    {
      selectedThreadId: rerenderedSelectedThreadId = selectedThreadId,
      threads: rerenderedThreads = threads,
    }: { selectedThreadId?: number | null; threads?: Thread[] } = {}
  ): Promise<void> => {
    rerenderBase(view(shown, rerenderedSelectedThreadId, rerenderedThreads));
    await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
  };
  return { onComment, onHoverThread, onNavigate, onSelectThread, render, rerender, unmount: () => unmount() };
}

/**
 * Sets up a test whose doc renders inside a scrolling box from 100px to 500px down the page, with every range in the
 * doc measured at the given distance down the page
 */
function setUpTestWithScrollContainer({ passageTop }: { passageTop: number }) {
  const scrollContainer = document.createElement("div");
  scrollContainer.style.overflowY = "auto";
  document.body.append(scrollContainer);
  vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 100, 800, 400));
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, passageTop, 200, 20));
  const scrolledTo: string[] = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
    scrolledTo.push(this.tagName);
  });
  const setUp = setUpTest({
    container: scrollContainer,
    selectedThreadId: 1,
    threads: [buildThread({ anchor: cacheAnchor, id: 1 })],
  });
  return { ...setUp, scrolledTo };
}

/**
 * Moves keyboard focus from the start of the page to the + beside the hovered block, past each of the doc's links
 */
/**
 * Stands in for ResizeObserver with one that reports a resize of everything observed when the test asks
 */
function standInForResizes(): { resize: () => void } {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      public constructor(callback: () => void) {
        callbacks.push(callback);
      }

      public disconnect(): void {}

      public observe(): void {}

      public unobserve(): void {}
    }
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return { resize: () => act(() => callbacks.forEach((callback) => callback())) };
}

/**
 * Moves the block that holds the text to the given distance down the page, as the next measurement of it sees it
 */
function moveBlockOf(text: HTMLElement, top: number): void {
  const block = text.closest("[data-md-block]");
  if (block !== null) {
    vi.spyOn(block, "getBoundingClientRect").mockReturnValue(new DOMRect(0, top, 600, 24));
  }
}

/**
 * Lays the plan out with the doc 40px from the view's left edge and its blocks 30px, 24px, 38px and 24px tall at 0px,
 * 54px, 94px and 140px down
 *
 * @param scrolledBy how far the doc has scrolled, which moves the view and everything in it up the page by as much
 */
function layOutBlocks(scrolledBy = 0): void {
  const article = elements.article();
  const view = article.parentElement;
  if (view !== null) {
    vi.spyOn(view, "getBoundingClientRect").mockReturnValue(new DOMRect(0, -scrolledBy));
  }
  vi.spyOn(article, "getBoundingClientRect").mockReturnValue(new DOMRect(40, -scrolledBy, 600, 164));
  const blocks = [
    { text: within(article).getByRole("heading", { level: 1, name: "Plan" }), top: 0, height: 30 },
    { text: within(article).getByText("We cache results for", { exact: false }), top: 54, height: 24 },
    { text: within(article).getByRole("heading", { level: 2, name: "Goals" }), top: 94, height: 38 },
    { text: within(article).getByText("Retries happen three times."), top: 140, height: 24 },
  ];
  for (const { height, text, top } of blocks) {
    const block = text.closest("[data-md-block]");
    if (block !== null) {
      vi.spyOn(block, "getBoundingClientRect").mockReturnValue(new DOMRect(40, top - scrolledBy, 600, height));
    }
  }
}

/**
 * Presses the main button with the pointer in the gutter, at the given distance down the page
 */
async function pressGutter(user: UserEvent, clientY: number): Promise<void> {
  await user.pointer({ coords: { clientX: 10, clientY }, keys: "[MouseLeft>]", target: elements.gutter() });
}

async function moveInGutter(user: UserEvent, clientY: number): Promise<void> {
  await user.pointer({ coords: { clientX: 10, clientY }, target: elements.gutter() });
}

async function releaseGutter(user: UserEvent): Promise<void> {
  await user.pointer({ keys: "[/MouseLeft]", target: elements.gutter() });
}

async function tabToBlockButton(user: UserEvent): Promise<void> {
  const linkCount = within(elements.article()).getAllByRole("link").length;
  for (let tabCount = 0; tabCount <= linkCount; tabCount += 1) {
    await user.tab();
  }
}

function selectText(from: string, through: string): void {
  const article = elements.article();
  const start = within(article).getByText(from, { exact: false }).firstChild;
  const end = within(article).getByText(through).firstChild;
  const range = document.createRange();
  range.setStart(start ?? article, start?.textContent?.indexOf(from) ?? 0);
  range.setEnd(end ?? article, through.length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

const elements = {
  article: () => screen.getByRole("article", { name: "docs/plan.md" }),
  bracketLane: () => screen.getByTestId("bracket-lane"),
  gutter: () => screen.getByTestId("block-gutter"),
  highlighted: (name: string): string[] => [...(CSS.highlights.get(name) ?? [])].map((range) => range.toString()),
  // NaN when no highlight has the name, as no comparison with NaN passes
  priority: (name: string): number => CSS.highlights.get(name)?.priority ?? Number.NaN,
  markers: (): string[] =>
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((label) => label.startsWith("Thread #")),
};
