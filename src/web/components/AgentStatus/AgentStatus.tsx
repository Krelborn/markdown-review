import { Cluster, StatusDot, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

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
    <Cluster gap={1} role="status">
      <StatusDot tone={agentWaiting ? "success" : "neutral"} variant={agentWaiting ? "solid" : "ring"} />
      <Text size="sm">{agentWaiting ? "Agent listening" : "Agent not listening"}</Text>
    </Cluster>
  );
}
