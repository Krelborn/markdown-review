import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { HoveredThreadContext } from "./HoveredThreadContext";

export interface HoveredThreadProviderProps {
  children: ReactNode;
}

/**
 * Holds the thread the user is pointing at and the thread whose card has the keyboard focus, for the doc and the
 * comments inside it; keeping them apart lets a focused card's thread stay hovered after the pointer passes over
 * another
 */
export function HoveredThreadProvider({ children }: HoveredThreadProviderProps): JSX.Element {
  const [pointedThreadId, setPointedThreadId] = useState<number | null>(null);
  const [focusedThreadId, setFocusedThreadId] = useState<number | null>(null);
  return (
    <HoveredThreadContext
      value={{
        hoveredThreadId: pointedThreadId ?? focusedThreadId,
        onFocusThread: setFocusedThreadId,
        onHoverThread: setPointedThreadId,
      }}
    >
      {children}
    </HoveredThreadContext>
  );
}
