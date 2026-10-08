import path from "node:path";

const contentTypes: Partial<Record<string, string>> = {
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

/**
 * Picks the Content-Type for a repo file from its extension
 *
 * @param filePath the file's path
 * @returns the media type, or application/octet-stream for an extension it does not know
 */
export function contentTypeFor(filePath: string): string {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
