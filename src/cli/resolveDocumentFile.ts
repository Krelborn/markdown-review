import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { CliError } from "./CliError";

/**
 * Resolves a path the agent typed to the real path of an existing file
 *
 * Following symlinks and the file system's own spelling of the name makes the path match the one the store records.
 *
 * @param workingDirectory the directory the path is relative to
 * @param target the path as typed
 * @returns the file's real absolute path
 * @throws CliError when the path is not a file
 */
export async function resolveDocumentFile(workingDirectory: string, target: string): Promise<string> {
  const absolutePath = path.resolve(workingDirectory, target);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null || !found.isFile()) {
    throw new CliError(`${target} is not a file`, "Check the path and run the command again with a markdown file.");
  }
  return realpath(absolutePath);
}
