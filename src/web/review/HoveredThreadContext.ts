import { createContext } from "react";

export interface HoveredThread {
  /**
   * The thread under the pointer, in the doc or the comments; else the thread whose card has the keyboard focus; else
   * null
   */
  hoveredThreadId: number | null;

  /**
   * Called with a thread when the keyboard focus moves into its card, and with null when the focus leaves the card
   */
  onFocusThread: (threadId: number | null) => void;

  /**
   * Called with a thread when the pointer moves onto it, and with null when the pointer leaves it
   */
  onHoverThread: (threadId: number | null) => void;
}

/**
 * The thread the user is pointing at or has focused, shared by the doc and the comments so each can emphasise it;
 * without a provider, nothing is hovered
 */
export const HoveredThreadContext = createContext<HoveredThread>({
  hoveredThreadId: null,
  onFocusThread: () => {},
  onHoverThread: () => {},
});
