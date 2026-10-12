import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { version } from "../../../../package.json";

import { AboutPopover } from "./AboutPopover";

describe("AboutPopover", () => {
  test("must show the app's name, version, description and copyright when the user presses About", async () => {
    const user = userEvent.setup();
    render(<AboutPopover update={null} />);

    await user.click(elements.aboutButton());

    const about = elements.aboutDialog();
    expect(about.getByText("Markdown Review")).toBeVisible();
    expect(about.getByText(`Version ${version}`)).toBeVisible();
    expect(
      about.getByText("Review agent-written markdown in the browser and hand the comments back to the agent")
    ).toBeVisible();
    expect(about.getByText("© 2026 Matt Styles")).toBeVisible();
  });

  test("must show the newer version and the command that installs it when an update is available", async () => {
    const user = userEvent.setup();
    render(<AboutPopover update={update} />);

    await user.click(screen.getByRole("button", { name: "About Markdown Review, update available" }));

    expect(
      elements
        .aboutDialog()
        .getByText("Version 9.0.0 is available. Ask your agent to update it, or run", { exact: false })
    ).toHaveTextContent(
      "Version 9.0.0 is available. Ask your agent to update it, or run npm install --global @krelborn/markdown-review@latest"
    );
  });

  test("must not mention an update when none is available", async () => {
    const user = userEvent.setup();
    render(<AboutPopover update={null} />);

    await user.click(elements.aboutButton());

    expect(elements.aboutDialog().queryByText("Ask your agent to update it", { exact: false })).not.toBeInTheDocument();
  });

  test.each([
    { href: `https://github.com/Krelborn/markdown-review/blob/v${version}/LICENSE`, name: "MIT License" },
    { href: "https://github.com/Krelborn/markdown-review#readme", name: "GitHub" },
    { href: "https://github.com/Krelborn/markdown-review/issues", name: "Report an issue" },
    { href: "/licences", name: "Third-party licences" },
  ])("must open $href in a new tab when the user follows $name", async ({ href, name }) => {
    const user = userEvent.setup();
    render(<AboutPopover update={null} />);

    await user.click(elements.aboutButton());

    const link = elements.aboutDialog().getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

const update = { command: "npm install --global @krelborn/markdown-review@latest", version: "9.0.0" };

const elements = {
  aboutButton: () => screen.getByRole("button", { name: "About Markdown Review" }),
  aboutDialog: () => within(screen.getByRole("dialog", { name: "About Markdown Review" })),
};
