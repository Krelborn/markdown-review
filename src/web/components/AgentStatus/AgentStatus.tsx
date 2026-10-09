import { StatusDot, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import styles from "./AgentStatus.module.css";

export interface AgentStatusProps {
  /**
   * Whether the agent has a poll open, waiting for the user to submit
   */
  agentWaiting: boolean;
}

/**
 * Says whether the agent is listening, so that it will hear of a submit at once
 */
export function AgentStatus({ agentWaiting }: AgentStatusProps): JSX.Element {
  return (
    <span className={styles.agentStatus} role="status">
      <StatusDot tone={agentWaiting ? "success" : "neutral"} variant={agentWaiting ? "solid" : "ring"} />
      <Text className={styles.label} size="sm">
        {agentWaiting ? "Agent listening" : "Agent not listening"}
      </Text>
    </span>
  );
}
