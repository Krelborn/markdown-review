import { Badge, Cluster, Heading, Link } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { DocumentsMenu } from "../DocumentsMenu/DocumentsMenu";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  agentWaiting: boolean;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  draftCount: number;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  review: ReviewState;
}

/**
 * The bar across the top of the page: where the user is, whether the agent is listening, and the submit button
 */
export function TopBar({
  agentWaiting,
  documentPath,
  draftCount,
  onNavigate,
  onSubmitted,
  review,
}: TopBarProps): JSX.Element {
  return (
    <Cluster as="header" className={styles.topBar} gap={4} justify="between">
      <Cluster gap={3}>
        <Link
          href="/"
          onClick={(event) => {
            if (isPlainLeftClick(event)) {
              event.preventDefault();
              onNavigate("/");
            }
          }}
          tone="inherit"
          underline="hover"
        >
          Markdown Review
        </Link>
        <Heading className={styles.path} level={1} size="md">
          {documentPath ?? "Docs"}
        </Heading>
        <DocumentsMenu onNavigate={onNavigate} />
      </Cluster>
      <Cluster gap={3}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
        <SubmitMenu draftCount={draftCount} onSubmitted={onSubmitted} />
      </Cluster>
    </Cluster>
  );
}
