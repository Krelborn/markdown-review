import { createContext } from "react";

export interface HoveredThread {
  /**
   * The thread under the pointer or the keyboard focus, in the doc or the comments, or null
   */
  hoveredThreadId: number | null;

  /**
   * Called with a thread when the pointer or the focus moves onto it, and with null when it leaves
   */
  onHoverThread: (threadId: number | null) => void;
}

/**
 * The thread the user is pointing at, shared by the doc and the comments so each can emphasise it; without a provider,
 * nothing is hovered
 */
export const HoveredThreadContext = createContext<HoveredThread>({ hoveredThreadId: null, onHoverThread: () => {} });
