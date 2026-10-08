import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import type { ReviewState } from "../../shared/review/ReviewState";

/**
 * Works out whether the current review round is approved
 *
 * @param reviewFile the review's stored timestamps
 * @returns the timestamps and whether the approval came after the latest request
 */
export function toReviewState({
  approvedAt,
  requestedAt,
}: Pick<ReviewFile, "approvedAt" | "requestedAt">): ReviewState {
  const approved = approvedAt !== null && (requestedAt === null || Date.parse(approvedAt) > Date.parse(requestedAt));
  return { approved, approvedAt, requestedAt };
}
