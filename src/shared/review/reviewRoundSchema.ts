import { z } from "zod";

import { documentPathSchema } from "./anchorSchema";

export const verdictSchema = z.enum(["revise", "go-ahead", "hand-back"]);

export const nextTaskSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((text) => !text.includes("\n"), "must be one line");

export const reviewRoundSchema = z.strictObject({
  documents: z.array(documentPathSchema),
  lastOpenedAt: z.iso.datetime(),
  nextTask: nextTaskSchema.nullable(),
  startedAt: z.iso.datetime(),
  verdict: z.strictObject({ at: z.iso.datetime(), kind: verdictSchema }).nullable(),
});

export type ReviewRound = z.infer<typeof reviewRoundSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
