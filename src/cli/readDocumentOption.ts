import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { CliError } from "./CliError";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 * @throws CliError when the doc does not exist
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }
  const absolutePath = path.resolve(await realpath(workingDirectory), value);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null) {
    throw new CliError(`${value} does not exist`, "Check the path and run the command again.");
  }
  return toRepositoryPath(root, absolutePath);
}
