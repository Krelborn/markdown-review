import { realpath } from "node:fs/promises";
import path from "node:path";

import type { ServerClient } from "./ServerClient";
import { CliError } from "./CliError";
import { locateDocument } from "./locateDocument";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * A doc that no longer exists is accepted when the store still holds threads for it, as it does when the doc was
 * deleted during the review. Any other path that is not a file is a typo, which would make a poll wait for threads that
 * can never match.
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @param client the root's review server
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 * @throws CliError when the path is neither a file inside the root nor a deleted doc with threads
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined,
  client: Pick<ServerClient, "documents">
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }
  const located = await locateDocument(workingDirectory, value);
  if (located !== null) {
    if (located.root !== root) {
      throw new CliError(
        `${value} is in the repository at ${located.root}, not at ${root}`,
        "Run the command from the directory of the repository that holds the doc."
      );
    }
    return located.document;
  }
  const document = toRepositoryPath(root, path.resolve(await realpath(workingDirectory), value));
  const { documents } = await client.documents();
  if (documents.some((known) => known.document === document)) {
    return document;
  }
  throw new CliError(
    `${value} does not exist, and the review has no threads on it`,
    "Check the path and run the command again, or run it without --document to cover every doc."
  );
}
