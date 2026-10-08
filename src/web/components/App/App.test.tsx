import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";

describe("App", () => {
  test("must name the tool when the page opens", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Markdown Review" })).toBeInTheDocument();
  });
});
