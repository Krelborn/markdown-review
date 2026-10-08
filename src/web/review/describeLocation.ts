import type { Anchor } from "../../shared/review/anchorSchema";

/**
 * Says where in its doc a thread is, for the sidebar
 *
 * @param anchor what the thread is on
 * @returns "Line 3", "Lines 12–13", "Whole doc" or "Whole review"
 */
export function describeLocation(anchor: Anchor): string {
  switch (anchor.kind) {
    case "review":
      return "Whole review";
    case "document":
      return "Whole doc";
    case "passage":
      return anchor.startLine === anchor.endLine
        ? `Line ${anchor.startLine}`
        : `Lines ${anchor.startLine}–${anchor.endLine}`;
  }
}
