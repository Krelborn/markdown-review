import { useCallback, useEffect, useRef } from "react";

export interface ThreadReporter {
  /**
   * Reports a thread, or null, unless it is the one the source reported last
   */
  report: (threadId: number | null) => void;

  /**
   * The thread the source reported last, or null
   */
  reported: () => number | null;
}

/**
 * Reports the thread one source of hover or focus is on, such as a card or the doc, and reports null when the source
 * unmounts on a thread, since removing an element under the pointer or with the focus fires no pointerleave or blur
 *
 * @param onThread the shared setter for the source's kind of thread; keep it stable, since a new one ends the last
 *   report
 */
export function useThreadReporter(onThread: (threadId: number | null) => void): ThreadReporter {
  const reportedRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (reportedRef.current !== null) {
        reportedRef.current = null;
        onThread(null);
      }
    },
    [onThread]
  );
  const report = useCallback(
    (threadId: number | null): void => {
      if (threadId !== reportedRef.current) {
        reportedRef.current = threadId;
        onThread(threadId);
      }
    },
    [onThread]
  );
  const reported = useCallback((): number | null => reportedRef.current, []);
  return { report, reported };
}
