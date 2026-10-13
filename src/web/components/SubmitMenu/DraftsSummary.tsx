import { Badge, Cluster, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DraftCount, DraftCounts } from "../../review/countDraftsByDocument";

export interface DraftsSummaryProps {
  /**
   * The drafts a submit sends and those it keeps, on each doc, the review's first
   */
  drafts: DraftCounts;
}

/**
 * Says how many drafts a submit sends and which docs they are on, then which docs have drafts it keeps
 */
export function DraftsSummary({ drafts: { kept, sent } }: DraftsSummaryProps): JSX.Element {
  const total = sent.reduce((sum, { count }) => sum + count, 0);
  return (
    <Stack gap={2}>
      {total === 0 ? (
        <Text as="p" size="sm">
          You have no drafts for this review.
        </Text>
      ) : (
        <Cluster gap={1}>
          <Text size="sm">Sends {total === 1 ? "1 draft" : `${total} drafts`}:</Text>
          {badgesFor(sent)}
        </Cluster>
      )}
      {kept.length > 0 && (
        <Cluster gap={1}>
          <Text size="sm">Not sent, from before this review:</Text>
          {badgesFor(kept)}
        </Cluster>
      )}
    </Stack>
  );
}

function badgesFor(drafts: readonly DraftCount[]): JSX.Element[] {
  return drafts.map(({ count, document }) => (
    <Badge key={document ?? ""} title={document ?? undefined}>
      {document === null ? "Whole review" : document.slice(document.lastIndexOf("/") + 1)} {count}
    </Badge>
  ));
}
