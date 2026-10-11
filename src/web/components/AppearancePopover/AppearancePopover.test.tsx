import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import type { Appearance } from "../../../shared/appearance/Appearance";
import { AppearanceProvider } from "../../appearance/AppearanceProvider";
import { setAppearanceCookies } from "../../testing/setAppearanceCookies";

import { AppearancePopover } from "./AppearancePopover";

describe("AppearancePopover", () => {
  test("must offer System and Paper as chosen when the user has chosen nothing", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(elements.appearanceButton());

    expect(elements.choice("System")).toBeChecked();
    expect(elements.choice("Paper")).toBeChecked();
  });

  test("must offer the user's choices as chosen when the cookies hold them", async () => {
    const { render } = setUpTest({ stored: { mode: "dark", palette: "mist" } });
    const user = userEvent.setup();
    render();

    await user.click(elements.appearanceButton());

    expect(elements.choice("Dark")).toBeChecked();
    expect(elements.choice("Mist")).toBeChecked();
  });

  test("must draw the page in the stored appearance when the cookies hold it", () => {
    const { render } = setUpTest({ stored: { mode: "light", palette: "dusk" } });

    render();

    expect(document.documentElement).toHaveAttribute("data-sui-mode", "light");
    expect(document.documentElement).toHaveAttribute("data-sui-palette", "dusk");
  });

  test.each([
    { choice: "Light", mode: "light" },
    { choice: "Dark", mode: "dark" },
    { choice: "System", mode: "system" },
  ])(
    "must draw the page in $mode mode and remember only that when the user chooses $choice",
    async ({ choice, mode }) => {
      const { render } = setUpTest({ stored: { mode: mode === "system" ? "dark" : "system" } });
      const user = userEvent.setup();
      render();

      await user.click(elements.appearanceButton());
      await user.click(elements.choice(choice));

      expect(elements.choice(choice)).toBeChecked();
      expect(document.documentElement).toHaveAttribute("data-sui-mode", mode);
      expect(document.cookie).toContain(`markdown-review-mode=${mode}`);
      expect(document.cookie).not.toContain("markdown-review-palette");
    }
  );

  test.each([
    { choice: "Bright", palette: "bright" },
    { choice: "Mist", palette: "mist" },
    { choice: "Dusk", palette: "dusk" },
    { choice: "Paper", palette: "paper" },
  ])(
    "must draw the page in $palette and remember only that when the user chooses $choice",
    async ({ choice, palette }) => {
      const { render } = setUpTest({ stored: { palette: palette === "paper" ? "bright" : "paper" } });
      const user = userEvent.setup();
      render();

      await user.click(elements.appearanceButton());
      await user.click(elements.choice(choice));

      expect(elements.choice(choice)).toBeChecked();
      expect(document.documentElement).toHaveAttribute("data-sui-palette", palette);
      expect(document.cookie).toContain(`markdown-review-palette=${palette}`);
      expect(document.cookie).not.toContain("markdown-review-mode");
    }
  );

  test.each([
    { choice: "Paper", description: "Warm, low glare" },
    { choice: "Bright", description: "White, crisp" },
    { choice: "Mist", description: "Cool grey page, white cards" },
    { choice: "Dusk", description: "Dimmest, softest" },
  ])("must describe $choice when the user opens the popover", async ({ choice, description }) => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(elements.appearanceButton());

    expect(elements.choice(choice)).toHaveAccessibleDescription(description);
  });

  test("must keep the popover open when the user makes a choice", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(elements.appearanceButton());
    await user.click(elements.choice("Dark"));

    expect(screen.getByRole("dialog", { name: "Appearance" })).toBeVisible();
  });
});

function setUpTest({ stored = {} }: { stored?: Partial<Appearance> } = {}) {
  setAppearanceCookies(stored);
  const render = (): void => {
    renderBase(
      <AppearanceProvider>
        <AppearancePopover />
      </AppearanceProvider>
    );
  };
  return { render };
}

const elements = {
  appearanceButton: () => screen.getByRole("button", { name: "Appearance" }),
  choice: (name: string) => within(screen.getByRole("dialog", { name: "Appearance" })).getByRole("radio", { name }),
};
