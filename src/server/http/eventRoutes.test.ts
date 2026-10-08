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

  test("must stop sending to the tab and let the server go idle when the tab disconnects", async () => {
    const { browser, idleCount, tabs } = await setUpAppTest(getDirectory(), { idleMilliseconds: 50 });
    const events = readServerSentEvents(await browser("GET", "/api/events"));
    const firstEvents = await events.next(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const idlesWhileConnected = idleCount();

    await events.close();

    expect(firstEvents).toEqual([{ data: { agentWaiting: false }, event: "presence" }]);
    expect(idlesWhileConnected).toBe(0);
    await vi.waitFor(() => expect(idleCount()).toBe(1));
    expect(tabs.navigateLatest("/")).toBe(false);
  });
});
