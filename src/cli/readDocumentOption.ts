import { CliError } from "./CliError";
import { locateDocument } from "./locateDocument";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * The doc may no longer exist: a doc deleted during the review keeps its threads, and the server decides whether any
 * remain.
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 * @throws CliError when the path is a directory or other non-file, is not inside the root, or leads to a file in
 *   another repository
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined
): Promise<string | null> {
  if (value === undefined) {
    return null;
  }
  const located = await locateDocument(workingDirectory, value);
  switch (located.kind) {
    case "not-a-file":
      throw new CliError(
        `${value} is not a file`,
        "Pass the path of a markdown file, or run the command without --document to cover every doc."
      );
    case "missing":
      return toRepositoryPath(root, located.path);
    case "file":
      if (located.root !== root) {
        throw new CliError(
          `${value} is in the repository at ${located.root}, not at ${root}`,
          "Run the command from the directory of the repository that holds the doc."
        );
      }
      return located.document;
  }
}
