import { z } from "zod";

import { documentPathSchema } from "../../shared/review/anchorSchema";

/**
 * What the server pushes to a review tab, and the tab's connection to it opening or dropping
 */
export const reviewEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ agentWaiting: z.boolean(), type: z.literal("presence") }),
  z.strictObject({ type: z.literal("threads-changed") }),
  z.strictObject({ document: documentPathSchema, type: z.literal("document-changed") }),
  z.strictObject({ type: z.literal("navigate"), url: z.string() }),
  z.strictObject({ type: z.literal("connected") }),
  z.strictObject({ type: z.literal("disconnected") }),
]);

export type ReviewEvent = z.infer<typeof reviewEventSchema>;
