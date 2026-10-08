import { z } from "zod";

import { contextLength, documentAnchorSchema, documentPathSchema, reviewAnchorSchema } from "./anchorSchema";
import { messageBodySchema } from "./threadSchema";

const newPassageAnchorSchema = z
  .strictObject({
    document: documentPathSchema,
    endOffset: z.int().nonnegative(),
    kind: z.literal("passage"),
    prefix: z.string().max(contextLength),
    quote: z.string().min(1),
    startOffset: z.int().nonnegative(),
    suffix: z.string().max(contextLength),
  })
  .refine((anchor) => anchor.endOffset - anchor.startOffset === anchor.quote.length, {
    message: "must span exactly its quote",
  });

export const newThreadSchema = z.strictObject({
  anchor: z.discriminatedUnion("kind", [reviewAnchorSchema, documentAnchorSchema, newPassageAnchorSchema]),
  body: messageBodySchema,
  renderedHash: z.string().optional(),
});

export type NewPassageAnchor = z.infer<typeof newPassageAnchorSchema>;
export type NewThread = z.infer<typeof newThreadSchema>;
