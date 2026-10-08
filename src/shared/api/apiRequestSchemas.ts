import { z } from "zod";

import { documentPathSchema } from "../review/anchorSchema";
import { messageBodySchema } from "../review/threadSchema";

export const agentOpenRequestSchema = z.strictObject({ path: documentPathSchema.optional() });

export const messageRequestSchema = z.strictObject({ body: messageBodySchema });

export const resolveRequestSchema = z.strictObject({ body: messageBodySchema.nullable() });

export const submitRequestSchema = z.strictObject({ verdict: z.enum(["request-changes", "approve"]) });

export type Verdict = z.infer<typeof submitRequestSchema>["verdict"];
