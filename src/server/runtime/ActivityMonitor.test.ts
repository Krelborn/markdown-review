import { afterEach, describe, expect, test, vi } from "vitest";

import type { ServerEvent } from "../events/ServerEvents";
import { ServerEvents } from "../events/ServerEvents";

import { ActivityMonitor } from "./ActivityMonitor";

const idleMilliseconds = 30 * 60_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("ActivityMonitor", () => {
  test("must call onIdle when nothing has happened for the idle period", () => {
    const { idleCalls } = setUpTest();

    vi.advanceTimersByTime(idleMilliseconds);

    expect(idleCalls()).toBe(1);
  });

  test("must not call onIdle while a tab is connected, and start counting again when it disconnects", () => {
    const { idleCalls, monitor } = setUpTest();
    const disconnect = monitor.beginBrowser();

    vi.advanceTimersByTime(idleMilliseconds * 2);
    const whileConnected = idleCalls();
    disconnect();
    vi.advanceTimersByTime(idleMilliseconds);

    expect([whileConnected, idleCalls()]).toEqual([0, 1]);
  });

  test("must restart the countdown when a request arrives", () => {
    const { idleCalls, monitor } = setUpTest();

    vi.advanceTimersByTime(idleMilliseconds - 1);
    monitor.touch();
    vi.advanceTimersByTime(idleMilliseconds - 1);

    expect(idleCalls()).toBe(0);
  });

  test("must never call onIdle once it has been stopped", () => {
    const { idleCalls, monitor } = setUpTest();

    monitor.stop();
    vi.advanceTimersByTime(idleMilliseconds * 2);

    expect(idleCalls()).toBe(0);
  });

  test("must report the agent waiting and publish presence changes when polls begin and end", () => {
    const { monitor, published } = setUpTest();

    const endFirst = monitor.beginPoll();
    const endSecond = monitor.beginPoll();
    const waitingWithTwo = monitor.agentWaiting;
    endFirst();
    endFirst();
    endSecond();

    expect(waitingWithTwo).toBe(true);
    expect(monitor.agentWaiting).toBe(false);
    expect(published).toEqual([
      { agentWaiting: true, type: "presence" },
      { agentWaiting: false, type: "presence" },
    ]);
  });
});

function setUpTest() {
  vi.useFakeTimers();
  const events = new ServerEvents();
  const published: ServerEvent[] = [];
  events.subscribe((event) => published.push(event));
  let calls = 0;
  const monitor = new ActivityMonitor({
    events,
    idleMilliseconds,
    onIdle: () => {
      calls += 1;
    },
  });
  return { idleCalls: () => calls, monitor, published };
}
