import { z } from "zod";

/**
 * The registry's dist-tags that matter here; any others are dropped
 */
export const distTagsSchema = z.object({
  latest: z.string().optional(),
  next: z.string().optional(),
});

export type DistTags = z.infer<typeof distTagsSchema>;

/**
 * The user's update check cache: when the registry was last asked, and the dist-tags it last gave
 */
export const updateCheckFileSchema = z.strictObject({
  checkedAt: z.iso.datetime(),
  distTags: distTagsSchema,
});

export type UpdateCheckFile = z.infer<typeof updateCheckFileSchema>;
