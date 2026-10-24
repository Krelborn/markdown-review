import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { CliError } from "./CliError";

/**
 * Resolves a doc path the agent typed to the real path of an existing file
 *
 * @param workingDirectory the directory the path is relative to
 * @param target the path as typed
 * @param nextStep what the agent should do after fixing the path
 * @returns the file's real path, so a symlink or a different case matches the path the store records
 * @throws CliError when the path is not an existing file
 */
export async function resolveDocumentFile(workingDirectory: string, target: string, nextStep: string): Promise<string> {
  const absolutePath = path.resolve(workingDirectory, target);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null || !found.isFile()) {
    throw new CliError(`${target} is not a file`, nextStep);
  }
  return realpath(absolutePath);
}
