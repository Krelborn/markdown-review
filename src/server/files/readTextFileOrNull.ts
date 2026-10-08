import { readFile } from "node:fs/promises";

import { isFileNotFound } from "./isFileNotFound";

/**
 * Reads a UTF-8 text file
 *
 * @param filePath the file to read
 * @returns the contents, or null when the file does not exist
 * @throws the file system error when the file exists but cannot be read
 */
export async function readTextFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isFileNotFound(error)) {
      return null;
    }
    throw error;
  }
}
