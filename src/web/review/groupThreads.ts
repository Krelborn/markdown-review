import type { Anchor } from "../../shared/review/anchorSchema";
import type { Thread } from "../../shared/review/threadSchema";

export interface ThreadGroups {
  drafts: Thread[];
  open: Thread[];
  outdated: Thread[];
  resolved: Thread[];
}

const anchorOrder: Record<Anchor["kind"], number> = { document: 1, passage: 2, review: 0 };

/**
 * Sorts threads into the sidebar's groups
 *
 * @param threads the threads to show
 * @returns new comments in drafts, resolved threads in resolved, and the rest in outdated when their passage was lost,
 *   otherwise in open; each group holds the review's threads first, then each doc's in path order, its whole-doc
 *   threads before its passages and passages in the order they appear
 */
export function groupThreads(threads: readonly Thread[]): ThreadGroups {
  const groups: ThreadGroups = { drafts: [], open: [], outdated: [], resolved: [] };
  for (const thread of [...threads].sort(compareThreads)) {
    groups[groupOf(thread)].push(thread);
  }
  return groups;
}

function groupOf({ anchor, status }: Thread): keyof ThreadGroups {
  if (status === "draft") {
    return "drafts";
  }
  if (status === "resolved") {
    return "resolved";
  }
  return anchor.kind === "passage" && anchor.outdated ? "outdated" : "open";
}

function compareThreads(left: Thread, right: Thread): number {
  return (
    documentOf(left.anchor).localeCompare(documentOf(right.anchor)) ||
    anchorOrder[left.anchor.kind] - anchorOrder[right.anchor.kind] ||
    startOf(left.anchor) - startOf(right.anchor) ||
    left.id - right.id
  );
}

function documentOf(anchor: Anchor): string {
  return anchor.kind === "review" ? "" : anchor.document;
}

function startOf(anchor: Anchor): number {
  return anchor.kind === "passage" ? anchor.startOffset : 0;
}
