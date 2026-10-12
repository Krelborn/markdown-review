import { useEffect, useState } from "react";

import type { ReviewApi } from "./ReviewApi";

export interface AvailableUpdate {
  /**
   * The shell command that installs it
   */
  command: string;

  version: string;
}

/**
 * Asks the server once whether a newer markdown-review is out
 *
 * @param api the review server's API
 * @returns the newer version and its install command, or null when there is none or the server cannot say
 */
export function useAvailableUpdate(api: ReviewApi): AvailableUpdate | null {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  useEffect(() => {
    let isCurrent = true;
    api.readUpdate().then(
      ({ availableVersion, command }) => {
        if (isCurrent && availableVersion !== null && command !== null) {
          setUpdate({ command, version: availableVersion });
        }
      },
      () => {
        // The About popover reads as it does with no update, which is all a failed check can mean to the user
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api]);
  return update;
}
