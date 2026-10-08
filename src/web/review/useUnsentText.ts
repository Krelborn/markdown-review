import { useContext, useState } from "react";

import { UnsentTextContext } from "./UnsentTextContext";

export interface UnsentText {
  body: string;

  /**
   * Replaces the text, and keeps it for when the box appears again
   */
  change: (body: string) => void;

  /**
   * Drops the kept text, once it is saved or the user cancels
   */
  forget: () => void;
}

/**
 * Holds the text of a comment box so that it outlives the box, as when its thread moves to another group
 *
 * @param key names the box, such as "reply:3"; without one, or outside an `UnsentTextContext`, the text lives only as
 *   long as the box
 * @param initialBody the text the box starts with when nothing unsent is kept for it
 */
export function useUnsentText(key: string | undefined, initialBody: string): UnsentText {
  const kept = useContext(UnsentTextContext);
  const [body, setBody] = useState(() => (key === undefined ? undefined : kept?.get(key)) ?? initialBody);
  return {
    body,
    change: (next) => {
      setBody(next);
      if (key !== undefined) {
        kept?.set(key, next);
      }
    },
    forget: () => {
      if (key !== undefined) {
        kept?.delete(key);
      }
    },
  };
}
