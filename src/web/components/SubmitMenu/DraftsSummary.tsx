import { Badge, Cluster, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DraftCount } from "../../review/countDraftsByDocument";

export interface DraftsSummaryProps {
  /**
   * The user's drafts on each doc, the review's first
   */
  drafts: DraftCount[];
}

/**
 * Says how many drafts a submit sends, and which docs they are on
 */
export function DraftsSummary({ drafts }: DraftsSummaryProps): JSX.Element {
  const total = drafts.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) {
    return (
      <Text as="p" size="sm">
        You have no drafts.
      </Text>
    );
  }
  return (
    <Cluster gap={1}>
      <Text size="sm">Sends {total === 1 ? "1 draft" : `${total} drafts`}:</Text>
      {drafts.map(({ count, document }) => (
        <Badge key={document ?? ""} title={document ?? undefined}>
          {document === null ? "Whole review" : document.slice(document.lastIndexOf("/") + 1)} {count}
        </Badge>
      ))}
    </Cluster>
  );
}
