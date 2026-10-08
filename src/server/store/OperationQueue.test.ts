import { describe, expect, test } from "vitest";

import { createGate } from "../testing/createGate";

import { OperationQueue } from "./OperationQueue";

describe("OperationQueue", () => {
  test("must run a single operation when one is enqueued", async () => {
    const queue = new OperationQueue();
    let executed = false;

    await queue.enqueue(async () => {
      executed = true;
    });

    expect(executed).toBe(true);
  });

  test("must run operations in call order when two are enqueued at the same time", async () => {
    const queue = new OperationQueue();
    const order: string[] = [];

    await Promise.all([
      queue.enqueue(async () => {
        order.push("first");
      }),
      queue.enqueue(async () => {
        order.push("second");
      }),
    ]);

    expect(order).toEqual(["first", "second"]);
  });

  test("must return the result of the operation when the operation completes", async () => {
    const queue = new OperationQueue();

    const result = await queue.enqueue(async () => 42);

    expect(result).toBe(42);
  });

  test("must not start the second task when the first is still running", async () => {
    const queue = new OperationQueue();
    const events: string[] = [];
    const firstStarted = createGate();
    const firstMayFinish = createGate();
    const first = queue.enqueue(async () => {
      events.push("first started");
      firstStarted.open();
      await firstMayFinish.wait();
      events.push("first finished");
    });
    await firstStarted.wait();

    const second = queue.enqueue(async () => {
      events.push("second started");
    });
    firstMayFinish.open();
    await Promise.all([first, second]);

    expect(events).toEqual(["first started", "first finished", "second started"]);
  });

  test("must reject when the operation rejects", async () => {
    const queue = new OperationQueue();

    const rejected = queue.enqueue(async () => {
      throw new Error("test error");
    });

    await expect(rejected).rejects.toThrow("test error");
  });

  test("must run the next operation when an earlier operation rejects", async () => {
    const queue = new OperationQueue();
    const order: string[] = [];

    const rejected = queue.enqueue(async () => {
      throw new Error("test error");
    });
    const accepted = queue.enqueue(async () => {
      order.push("second");
    });

    await expect(rejected).rejects.toThrow("test error");
    await accepted;
    expect(order).toEqual(["second"]);
  });
});
