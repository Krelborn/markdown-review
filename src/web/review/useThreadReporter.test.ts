import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { useThreadReporter } from "./useThreadReporter";

describe("useThreadReporter", () => {
  test("must pass a thread on when it is not the one last reported", () => {
    const { onThread, result } = setUpTest();

    result.current.report(1);
    result.current.report(2);

    expect(onThread.mock.calls).toEqual([[1], [2]]);
  });

  test("must pass nothing on when the thread is the one last reported", () => {
    const { onThread, result } = setUpTest();
    result.current.report(1);

    result.current.report(1);

    expect(onThread.mock.calls).toEqual([[1]]);
  });

  test("must give the thread last reported when asked", () => {
    const { result } = setUpTest();

    result.current.report(1);

    expect(result.current.reported()).toBe(1);
  });

  test("must report no thread when the source goes away with a thread reported", () => {
    const { onThread, result, unmount } = setUpTest();
    result.current.report(1);

    unmount();

    expect(onThread).toHaveBeenLastCalledWith(null);
  });

  test("must pass nothing on when the source goes away with no thread reported", () => {
    const { onThread, result, unmount } = setUpTest();
    result.current.report(1);
    result.current.report(null);

    unmount();

    expect(onThread.mock.calls).toEqual([[1], [null]]);
  });
});

function setUpTest() {
  const onThread = vi.fn<(threadId: number | null) => void>();
  return { onThread, ...renderHook(() => useThreadReporter(onThread)) };
}
