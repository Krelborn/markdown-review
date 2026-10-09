import { useState } from "react";

import type { Thread } from "../../shared/review/threadSchema";
import { documentPagePath } from "../navigation/documentPagePath";

export interface ThreadSelection {
  /**
   * Counts the user's requests to see the selected thread in its doc; each new one scrolls its passage into view
   */
  revealCount: number;

  /**
   * Selects a thread and shows it in its doc, going to the doc if another is on screen
   */
  revealThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Selects a thread without asking to see it, as when the user clicks its passage in the doc
   */
  selectThread: (threadId: number) => void;
}

/**
 * The thread the user has selected, and their requests to see it in its doc
 *
 * @param documentPath the doc on screen, or null on the docs list
 * @param navigate shows another page of the app
 */
export function useThreadSelection(documentPath: string | null, navigate: (pagePath: string) => void): ThreadSelection {
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const revealThread = (thread: Thread): void => {
    setSelectedThreadId(thread.id);
    setRevealCount((count) => count + 1);
    if (thread.anchor.kind !== "review" && thread.anchor.document !== documentPath) {
      navigate(documentPagePath(thread.anchor.document));
    }
  };
  return { revealCount, revealThread, selectedThreadId, selectThread: setSelectedThreadId };
}
