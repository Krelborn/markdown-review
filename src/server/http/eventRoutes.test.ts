import { describe, expect, test, vi } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { readServerSentEvents } from "./testing/readServerSentEvents";
import { setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("eventRoutes", () => {
  test("must send the agent's presence first, then changes and navigation to the connected tab", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    const events = readServerSentEvents(await browser("GET", "/api/events"));

    await agent("POST", "/api/agent/open", { path: "docs/plan.md" });

    expect(await events.next(3)).toEqual([
      { data: { agentWaiting: false }, event: "presence" },
      { data: {}, event: "threads-changed" },
      { data: { url: "http://127.0.0.1:4321/document/docs/plan.md" }, event: "navigate" },
    ]);
    await events.close();
  });

  test("must stop sending to the tab and count it as gone when the tab disconnects", async () => {
    const { activity, browser, tabs } = await setUpAppTest(getDirectory());
    const events = readServerSentEvents(await browser("GET", "/api/events"));
    await events.next(1);

    await events.close();

    await vi.waitFor(() => expect(tabs.navigateLatest("/")).toBe(false));
    expect(activity.agentWaiting).toBe(false);
  });
});
