import { realpath } from "node:fs/promises";

import { resolveDocumentFile } from "./resolveDocumentFile";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 * @throws CliError when the doc is not an existing file inside the root
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }
  const file = await resolveDocumentFile(
    await realpath(workingDirectory),
    value,
    "Check the path and run the command again with `--document <path>`, or without `--document`."
  );
  return toRepositoryPath(root, file);
}
