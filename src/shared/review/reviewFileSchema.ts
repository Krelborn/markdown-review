import { z } from "zod";

import { reviewFileVersion } from "./reviewFileVersion";
import { reviewRoundSchema } from "./reviewRoundSchema";
import { threadSchema } from "./threadSchema";

export const reviewThreadsSchema = z
  .array(threadSchema)
  .refine((threads) => threads.every((thread) => thread.anchor.kind === "review"), {
    message: "must hold only threads on the whole review",
  });

export const reviewFileSchema = z.strictObject({
  round: reviewRoundSchema.nullable(),
  threads: reviewThreadsSchema,
  version: z.literal(reviewFileVersion),
});

export type ReviewFile = z.infer<typeof reviewFileSchema>;
