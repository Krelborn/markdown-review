import { describe, expect, test } from "vitest";

import type { ServerEvent } from "./ServerEvents";
import { ServerEvents } from "./ServerEvents";

describe("ServerEvents", () => {
  test("must deliver each published event to every subscriber when several are subscribed", () => {
    const events = new ServerEvents();
    const first: ServerEvent[] = [];
    const second: ServerEvent[] = [];
    events.subscribe((event) => first.push(event));
    events.subscribe((event) => second.push(event));

    events.publish({ type: "submitted" });

    expect([first, second]).toEqual([[{ type: "submitted" }], [{ type: "submitted" }]]);
  });

  test("must stop delivering events to a subscriber when it unsubscribes", () => {
    const events = new ServerEvents();
    const received: ServerEvent[] = [];
    const unsubscribe = events.subscribe((event) => received.push(event));

    unsubscribe();
    events.publish({ type: "threads-changed" });

    expect(received).toEqual([]);
  });
});
