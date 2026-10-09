import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

export interface CommentsPanel {
  /**
   * Hides the panel, moving focus from inside it to the toggle
   */
  close: () => void;

  /**
   * The panel's Hide comments button, which takes focus when the user opens the panel from the toggle
   */
  closeButtonRef: RefObject<HTMLButtonElement | null>;

  /**
   * Whether the panel is open, which matters only in a narrow window
   */
  isOpen: boolean;

  /**
   * Shows the panel and leaves focus where it is, as when the user starts a comment or picks a thread in the doc
   */
  open: () => void;

  panelRef: RefObject<HTMLDivElement | null>;

  /**
   * Shows or hides the panel from its toggle; showing it moves focus to the Hide comments button
   */
  toggle: () => void;

  toggleRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Whether the comments panel is open as a drawer in a narrow window, and where keyboard focus goes as it opens and
 * closes
 */
export function useCommentsPanel(): CommentsPanel {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef<RefObject<HTMLButtonElement | null> | null>(null);
  useEffect(() => {
    const target = focusAfterChange.current;
    focusAfterChange.current = null;
    target?.current?.focus();
  }, [isOpen]);
  const close = (): void => {
    if (isOpen && panelRef.current?.contains(document.activeElement) === true) {
      focusAfterChange.current = toggleRef;
    }
    setIsOpen(false);
  };
  const toggle = (): void => {
    if (!isOpen) {
      focusAfterChange.current = closeButtonRef;
    }
    setIsOpen(!isOpen);
  };
  return { close, closeButtonRef, isOpen, open: () => setIsOpen(true), panelRef, toggle, toggleRef };
}
