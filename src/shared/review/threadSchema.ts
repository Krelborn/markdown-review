import { z } from "zod";

import { anchorSchema } from "./anchorSchema";

export const messageBodySchema = z.string().refine((body) => body.trim() !== "", "must not be blank");

const messageSchema = z.strictObject({
  at: z.iso.datetime(),
  author: z.enum(["user", "agent"]),
  body: messageBodySchema,
});

const draftMessageSchema = z.strictObject({ at: z.iso.datetime(), body: messageBodySchema });

export const threadSchema = z
  .strictObject({
    anchor: anchorSchema,
    createdAt: z.iso.datetime(),
    draft: draftMessageSchema.optional(),
    id: z.int().positive(),
    messages: z.array(messageSchema),
    status: z.enum(["draft", "open", "resolved"]),
    updatedAt: z.iso.datetime(),
  })
  .refine((thread) => (thread.status === "draft") === (thread.messages.length === 0), {
    message: "must have messages unless it is a draft",
  })
  .refine((thread) => thread.status !== "draft" || thread.draft !== undefined, {
    message: "must hold its comment as a draft while it is a draft",
  });

export type Thread = z.infer<typeof threadSchema>;
