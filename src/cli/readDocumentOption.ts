import { realpath } from "node:fs/promises";
import path from "node:path";

import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined
): Promise<string | null> {
  return value === undefined ? null : toRepositoryPath(root, path.resolve(await realpath(workingDirectory), value));
}
