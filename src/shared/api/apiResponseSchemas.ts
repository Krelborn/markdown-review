import { z } from "zod";

import type { ReviewState } from "../review/ReviewState";
import { threadSchema } from "../review/threadSchema";

const reviewStateSchema = z.strictObject({
  approved: z.boolean(),
  approvedAt: z.iso.datetime().nullable(),
  requestedAt: z.iso.datetime().nullable(),
}) satisfies z.ZodType<ReviewState>;

/**
 * Not strict, so a newer server that reports more fields is still recognised by its protocol rather than mistaken for
 * no server
 */
export const healthSchema = z.object({
  name: z.literal("markdown-review"),
  pid: z.int(),
  protocol: z.int(),
  root: z.string(),
  version: z.string(),
});

export const threadsSnapshotSchema = z.strictObject({
  problems: z.array(z.string()),
  review: reviewStateSchema,
  threads: z.array(threadSchema),
});

export const pollResponseSchema = threadsSnapshotSchema.extend({ timedOut: z.boolean() });

export const agentOpenResponseSchema = z.strictObject({
  navigated: z.boolean(),
  review: reviewStateSchema,
  url: z.string(),
});

export const agentThreadResponseSchema = z.strictObject({ inbox: threadsSnapshotSchema, thread: threadSchema });

export const shutdownResponseSchema = z.strictObject({ stopping: z.literal(true) });

export const apiErrorSchema = z.strictObject({ error: z.strictObject({ message: z.string(), reason: z.string() }) });

export type Health = z.infer<typeof healthSchema>;
export type ThreadsSnapshot = z.infer<typeof threadsSnapshotSchema>;
export type PollResponse = z.infer<typeof pollResponseSchema>;
export type AgentOpenResponse = z.infer<typeof agentOpenResponseSchema>;
export type AgentThreadResponse = z.infer<typeof agentThreadResponseSchema>;
export type ShutdownResponse = z.infer<typeof shutdownResponseSchema>;
