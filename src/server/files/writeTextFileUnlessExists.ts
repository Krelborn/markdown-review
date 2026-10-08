import { writeFile } from "node:fs/promises";

/**
 * Creates a UTF-8 text file, leaving any file already at that path alone
 *
 * @param filePath the file to create
 * @param contents the text to write
 * @returns true when the file was created; false when a file already existed, so nothing was written
 * @throws the file system error for any other failure
 */
export async function writeTextFileUnlessExists(filePath: string, contents: string): Promise<boolean> {
  try {
    await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}
