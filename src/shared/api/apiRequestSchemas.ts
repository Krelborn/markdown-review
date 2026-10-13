import { z } from "zod";

import { documentPathSchema } from "../review/anchorSchema";
import { nextTaskSchema, verdictSchema } from "../review/reviewRoundSchema";
import { messageBodySchema } from "../review/threadSchema";

export const agentOpenRequestSchema = z.strictObject({
  nextTask: nextTaskSchema.optional(),
  path: documentPathSchema.optional(),
});

export const messageRequestSchema = z.strictObject({ body: messageBodySchema });

export const resolveRequestSchema = z.strictObject({ body: messageBodySchema.nullable() });

export const submitRequestSchema = z.strictObject({ verdict: verdictSchema });
