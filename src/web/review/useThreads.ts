import { useCallback, useEffect, useState } from "react";

import type { ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import { describeFailure } from "../api/describeFailure";
import type { ReviewApi } from "../api/ReviewApi";

export interface ThreadsState {
  error: string | null;

  /**
   * Reads the threads again
   */
  refresh: () => void;

  /**
   * Every thread in the repo and the review's state, or null until they are first read
   */
  snapshot: ThreadsSnapshot | null;
}

/**
 * Reads every thread in the repo, and again whenever asked
 */
export function useThreads(api: ReviewApi): ThreadsState {
  const [snapshot, setSnapshot] = useState<ThreadsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let isCurrent = true;
    api.readThreads().then(
      (next) => {
        if (isCurrent) {
          setSnapshot(next);
          setError(null);
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setError(describeFailure(failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, revision]);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return { error, refresh, snapshot };
}
