import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

// Callers destructure these rather than holding the whole object: the React Compiler treats an object as a ref once one
// of its refs is passed to a `ref` prop, and then flags every other read of it during render
export interface CommentsPanel {
  /**
   * The panel's Hide comments button, which takes focus when the user opens the panel from the toggle
   */
  closeButtonRef: RefObject<HTMLButtonElement | null>;

  /**
   * Hides the panel, moving focus from inside it to the toggle
   */
  closePanel: () => void;

  /**
   * Whether the panel is open, which matters only in a narrow window
   */
  isPanelOpen: boolean;

  /**
   * Shows the panel and leaves focus where it is, as when the user starts a comment or picks a thread in the doc
   */
  openPanel: () => void;

  panelRef: RefObject<HTMLDivElement | null>;

  panelToggleRef: RefObject<HTMLButtonElement | null>;

  /**
   * Shows or hides the panel from its toggle; showing it moves focus to the Hide comments button
   */
  togglePanel: () => void;
}

/**
 * Whether the comments panel is open as a drawer in a narrow window, and where keyboard focus goes as it opens and
 * closes
 */
export function useCommentsPanel(): CommentsPanel {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef<RefObject<HTMLButtonElement | null> | null>(null);
  useEffect(() => {
    const target = focusAfterChange.current;
    focusAfterChange.current = null;
    target?.current?.focus();
  }, [isPanelOpen]);
  const closePanel = (): void => {
    if (isPanelOpen && panelRef.current?.contains(document.activeElement) === true) {
      focusAfterChange.current = panelToggleRef;
    }
    setIsPanelOpen(false);
  };
  const togglePanel = (): void => {
    if (!isPanelOpen) {
      focusAfterChange.current = closeButtonRef;
    }
    setIsPanelOpen(!isPanelOpen);
  };
  return {
    closeButtonRef,
    closePanel,
    isPanelOpen,
    openPanel: () => setIsPanelOpen(true),
    panelRef,
    panelToggleRef,
    togglePanel,
  };
}
