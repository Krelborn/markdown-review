import { z } from "zod";

import { documentPathSchema } from "./anchorSchema";
import { storeFileVersion } from "./storeFileVersion";
import { threadSchema } from "./threadSchema";

export const documentThreadsFileSchema = z
  .strictObject({
    document: documentPathSchema,
    sourceHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    threads: z.array(threadSchema),
    version: z.literal(storeFileVersion),
  })
  .refine(
    (file) =>
      file.threads.every((thread) => thread.anchor.kind !== "review" && thread.anchor.document === file.document),
    { message: "must hold only threads anchored to its own doc" }
  );

export type DocumentThreadsFile = z.infer<typeof documentThreadsFileSchema>;
