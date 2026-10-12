import { readStoreFile } from "../store/readStoreFile";

import type { UpdateCheckFile } from "./updateCheckFileSchema";
import { updateCheckFileSchema } from "./updateCheckFileSchema";

/**
 * Reads the user's update check cache
 *
 * @param filePath the cache file
 * @returns the cache, or null when it is missing, unreadable or invalid
 */
export async function readUpdateCheckFile(filePath: string): Promise<UpdateCheckFile | null> {
  try {
    const result = await readStoreFile(filePath, updateCheckFileSchema);
    return result.kind === "valid" ? result.value : null;
  } catch {
    return null;
  }
}
