import { z } from "zod";

/**
 * `.markdown-review/server.json`: how the CLI finds and authenticates to the root's running server
 *
 * Not strict, so a newer server that records more fields is still recognised by its protocol rather than mistaken for
 * no server
 */
export const serverFileSchema = z.object({
  pid: z.int(),
  port: z.int().min(1).max(65535),
  protocol: z.int(),
  root: z.string(),
  startedAt: z.iso.datetime(),
  token: z.string().regex(/^[0-9a-f]{64}$/),
  version: z.string(),
});

export type ServerFile = z.infer<typeof serverFileSchema>;
