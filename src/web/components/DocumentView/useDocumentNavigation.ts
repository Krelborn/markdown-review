import type { RefObject } from "react";

import type { Thread } from "../../../shared/review/threadSchema";

import { useDocumentClicks } from "./useDocumentClicks";
import type { RenderedDocument } from "./useRenderedDocument";
import { useRevealSelectedThread } from "./useRevealSelectedThread";
import { useScrollToHeading } from "./useScrollToHeading";

export interface DocumentNavigation {
  documentPath: string;

  /**
   * The page address's fragment, such as "#goals", or an empty string
   */
  hash: string;

  /**
   * The threads whose passages are highlighted
   */
  highlightedThreads: readonly Thread[];

  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;
}

/**
 * Moves around the rendered doc: follows its links, selects a thread from a click on its highlight, scrolls to the
 * heading the address names, and brings the selected thread's passage into view
 */
export function useDocumentNavigation(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, hash, highlightedThreads, onNavigate, onSelectThread, selectedThreadId }: DocumentNavigation
): void {
  useDocumentClicks(contentRef, rendered, highlightedThreads, { onNavigate, onSelectThread });
  useRevealSelectedThread(contentRef, rendered, highlightedThreads, selectedThreadId);
  useScrollToHeading(contentRef, rendered, documentPath, hash);
}
