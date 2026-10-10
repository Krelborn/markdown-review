import { act, renderHook } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, test } from "vitest";

import { HoveredThreadContext } from "./HoveredThreadContext";
import { HoveredThreadProvider } from "./HoveredThreadProvider";

describe("HoveredThreadProvider", () => {
  test("must report the thread under the pointer as hovered when another thread's card has the focus", () => {
    const { result } = renderHoveredThread();

    act(() => result.current.onFocusThread(1));
    act(() => result.current.onHoverThread(2));

    expect(result.current.hoveredThreadId).toBe(2);
  });

  test("must report the focused card's thread as hovered when the pointer leaves another thread", () => {
    const { result } = renderHoveredThread();
    act(() => result.current.onFocusThread(1));
    act(() => result.current.onHoverThread(2));

    act(() => result.current.onHoverThread(null));

    expect(result.current.hoveredThreadId).toBe(1);
  });

  test("must report no hovered thread when the pointer and the focus have both left", () => {
    const { result } = renderHoveredThread();
    act(() => result.current.onFocusThread(1));
    act(() => result.current.onHoverThread(1));

    act(() => result.current.onHoverThread(null));
    act(() => result.current.onFocusThread(null));

    expect(result.current.hoveredThreadId).toBeNull();
  });
});

function renderHoveredThread() {
  return renderHook(() => useContext(HoveredThreadContext), { wrapper: HoveredThreadProvider });
}
