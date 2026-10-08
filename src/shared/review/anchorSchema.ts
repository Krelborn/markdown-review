import { z } from "zod";

import { isRepositoryRelativePath } from "./isRepositoryRelativePath";

export const contextLength = 32;

export const documentPathSchema = z.string().refine(isRepositoryRelativePath, "must be a repo-relative POSIX path");

export const reviewAnchorSchema = z.strictObject({ kind: z.literal("review") });

export const documentAnchorSchema = z.strictObject({ document: documentPathSchema, kind: z.literal("document") });

const passageAnchorSchema = z
  .strictObject({
    anchoredText: z.string().min(1),
    document: documentPathSchema,
    endLine: z.int().positive(),
    endOffset: z.int().nonnegative(),
    kind: z.literal("passage"),
    outdated: z.boolean(),
    prefix: z.string().max(contextLength),
    quote: z.string().min(1),
    startLine: z.int().positive(),
    startOffset: z.int().nonnegative(),
    suffix: z.string().max(contextLength),
  })
  .refine((anchor) => anchor.startLine <= anchor.endLine && anchor.startOffset <= anchor.endOffset, {
    message: "must not end before it starts",
  });

export const anchorSchema = z.discriminatedUnion("kind", [
  reviewAnchorSchema,
  documentAnchorSchema,
  passageAnchorSchema,
]);

export type Anchor = z.infer<typeof anchorSchema>;
export type PassageAnchor = z.infer<typeof passageAnchorSchema>;
