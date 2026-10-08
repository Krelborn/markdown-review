import { z } from "zod";

import { storeFileVersion } from "./storeFileVersion";
import { threadSchema } from "./threadSchema";

export const reviewFileSchema = z
  .strictObject({
    approvedAt: z.iso.datetime().nullable(),
    requestedAt: z.iso.datetime().nullable(),
    threads: z.array(threadSchema),
    version: z.literal(storeFileVersion),
  })
  .refine((file) => file.threads.every((thread) => thread.anchor.kind === "review"), {
    message: "must hold only threads on the whole review",
  });

export type ReviewFile = z.infer<typeof reviewFileSchema>;
