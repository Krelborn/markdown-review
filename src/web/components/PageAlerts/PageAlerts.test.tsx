import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { ThreadsState } from "../../review/useThreads";

import { PageAlerts } from "./PageAlerts";

describe("PageAlerts", () => {
  test("must show nothing when the server is connected and every comment could be read", () => {
    render(<PageAlerts isConnected={true} threads={buildThreadsState()} />);

    expect(screen.queryByText("Lost the connection to the review server")).not.toBeInTheDocument();
    expect(screen.queryByText("Some comments could not be read")).not.toBeInTheDocument();
  });

  test("must say the connection is lost when the server is not connected", () => {
    render(<PageAlerts isConnected={false} threads={buildThreadsState()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Lost the connection to the review server");
  });

  test("must list every problem when the threads or some comments could not be read", () => {
    render(
      <PageAlerts
        isConnected={true}
        threads={buildThreadsState({ error: "The server refused the request", problems: ["docs/plan.md is invalid"] })}
      />
    );

    expect(screen.getByText("Some comments could not be read")).toBeInTheDocument();
    expect(screen.getByText("The server refused the request docs/plan.md is invalid")).toBeInTheDocument();
  });
});

function buildThreadsState({
  error = null,
  problems = [],
}: { error?: string | null; problems?: string[] } = {}): ThreadsState {
  return {
    error,
    refresh: () => {},
    snapshot: { problems, review: { approved: false, approvedAt: null, requestedAt: null }, threads: [] },
  };
}
