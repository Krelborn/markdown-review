import { z } from "zod";

import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import { reviewFileSchema, reviewThreadsSchema } from "../../shared/review/reviewFileSchema";
import { reviewFileVersion } from "../../shared/review/reviewFileVersion";

const reviewFileVersion1Schema = z.strictObject({
  approvedAt: z.iso.datetime().nullable(),
  requestedAt: z.iso.datetime().nullable(),
  threads: reviewThreadsSchema,
  version: z.literal(1),
});

/**
 * Reads `review.json` as written by any version, giving the current version
 */
export const storedReviewFileSchema = z
  .discriminatedUnion("version", [reviewFileSchema, reviewFileVersion1Schema])
  .transform((file) => (file.version === 1 ? upgradeVersion1(file) : file));

/**
 * @param file a version 1 file, which recorded when the agent last opened the review and when the user last approved
 * @returns the same threads, with no round when no review was opened, otherwise a round on no docs that started at the
 *   last open and ended with Go ahead when the approval came after it
 */
function upgradeVersion1({ approvedAt, requestedAt, threads }: z.infer<typeof reviewFileVersion1Schema>): ReviewFile {
  if (requestedAt === null) {
    return { round: null, threads, version: reviewFileVersion };
  }
  const approved = approvedAt !== null && Date.parse(approvedAt) > Date.parse(requestedAt);
  return {
    round: {
      documents: [],
      lastOpenedAt: requestedAt,
      nextTask: null,
      startedAt: requestedAt,
      verdict: approved ? { at: approvedAt, kind: "go-ahead" } : null,
    },
    threads,
    version: reviewFileVersion,
  };
}
