import { z } from "zod";

import { reviewFileVersion } from "./reviewFileVersion";
import { reviewRoundSchema } from "./reviewRoundSchema";
import { threadSchema } from "./threadSchema";

export const reviewFileSchema = z
  .strictObject({
    round: reviewRoundSchema.nullable(),
    threads: z.array(threadSchema),
    version: z.literal(reviewFileVersion),
  })
  .refine((file) => file.threads.every((thread) => thread.anchor.kind === "review"), {
    message: "must hold only threads on the whole review",
  });

export type ReviewFile = z.infer<typeof reviewFileSchema>;
