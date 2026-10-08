import { useState } from "react";
import { z } from "zod";

import type { Thread } from "../../shared/review/threadSchema";

const storageKey = "markdown-review.seenMessageCounts";

const seenCountsSchema = z.record(z.string(), z.int().nonnegative());

export interface SeenMessages {
  /**
   * Whether the agent has written to the thread since the user last viewed it
   */
  hasNewAgentMessage(thread: Thread): boolean;

  /**
   * Records that the user has viewed every message on the thread
   */
  markSeen(thread: Thread): void;
}

/**
 * Remembers, across reloads of the page, how many of each thread's messages the user has viewed
 *
 * @returns what is new and a way to mark a thread viewed; a stored record the app cannot read starts afresh
 */
export function useSeenMessages(): SeenMessages {
  const [seenCounts, setSeenCounts] = useState(readSeenCounts);
  return {
    hasNewAgentMessage: (thread) =>
      thread.messages.findLastIndex((message) => message.author === "agent") >= (seenCounts[thread.id] ?? 0),
    markSeen: (thread) => {
      if (seenCounts[thread.id] === thread.messages.length) {
        return;
      }
      const next = { ...seenCounts, [thread.id]: thread.messages.length };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSeenCounts(next);
    },
  };
}

function readSeenCounts(): Record<string, number> {
  try {
    return seenCountsSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
  } catch {
    return {};
  }
}
