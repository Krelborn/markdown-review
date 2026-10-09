import type { JSX, ReactNode } from "react";
import { useState } from "react";

import { HoveredThreadContext } from "./HoveredThreadContext";

export interface HoveredThreadProviderProps {
  children: ReactNode;
}

/**
 * Holds the thread the user is pointing at, for the doc and the comments inside it
 */
export function HoveredThreadProvider({ children }: HoveredThreadProviderProps): JSX.Element {
  const [hoveredThreadId, setHoveredThreadId] = useState<number | null>(null);
  return (
    <HoveredThreadContext value={{ hoveredThreadId, onHoverThread: setHoveredThreadId }}>
      {children}
    </HoveredThreadContext>
  );
}
