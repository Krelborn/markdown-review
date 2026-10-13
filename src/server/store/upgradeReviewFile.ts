import { z } from "zod";

import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import { reviewFileVersion } from "../../shared/review/reviewFileVersion";
import { threadSchema } from "../../shared/review/threadSchema";

export const reviewFileVersion1Schema = z
  .strictObject({
    approvedAt: z.iso.datetime().nullable(),
    requestedAt: z.iso.datetime().nullable(),
    threads: z.array(threadSchema),
    version: z.literal(1),
  })
  .refine((file) => file.threads.every((thread) => thread.anchor.kind === "review"), {
    message: "must hold only threads on the whole review",
  });

/**
 * Reads a version 1 review file as the current version
 *
 * @param file the version 1 file, which recorded when the agent last opened the review and when the user last approved
 * @returns the same threads, with no round when no review was opened, otherwise a round on no docs that started at the
 *   last open and ended with Go ahead when the approval came after it
 */
export function upgradeReviewFile({
  approvedAt,
  requestedAt,
  threads,
}: z.infer<typeof reviewFileVersion1Schema>): ReviewFile {
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
