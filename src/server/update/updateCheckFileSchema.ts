import { z } from "zod";

/**
 * The registry's dist-tags that matter here; any others are dropped
 */
const distTagsSchema = z.object({
  latest: z.string().optional(),
  next: z.string().optional(),
});

export type DistTags = z.infer<typeof distTagsSchema>;
