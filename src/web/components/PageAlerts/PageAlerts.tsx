import { Alert, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ThreadsState } from "../../review/useThreads";

import styles from "./PageAlerts.module.css";

export interface PageAlertsProps {
  /**
   * Whether the event stream from the review server is connected
   */
  isConnected: boolean;

  threads: ThreadsState;
}

/**
 * The alerts across the page beneath the top bar: a lost connection to the server, and comments that could not be read
 */
export function PageAlerts({ isConnected, threads }: PageAlertsProps): JSX.Element | null {
  const problems = [...(threads.error === null ? [] : [threads.error]), ...(threads.snapshot?.problems ?? [])];
  if (isConnected && problems.length === 0) {
    return null;
  }
  return (
    <Stack className={styles.pageAlerts} gap={2}>
      {!isConnected && (
        <Alert role="alert" title="Lost the connection to the review server" tone="warning">
          Trying again. If the server has stopped, ask the agent to run <code>markdown-review open</code>, which starts
          it again.
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert title="Some comments could not be read" tone="danger">
          {problems.join(" ")}
        </Alert>
      )}
    </Stack>
  );
}
