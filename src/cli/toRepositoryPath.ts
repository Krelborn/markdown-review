import path from "node:path";

import { CliError } from "./CliError";

/**
 * Turns a path the agent typed into the repo-relative POSIX path the server uses
 *
 * @param root the root's real path
 * @param absolutePath the path, already resolved against the working directory
 * @throws CliError when the path is outside the root
 */
export function toRepositoryPath(root: string, absolutePath: string): string {
  const relativePath = path.relative(root, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new CliError(
      `${absolutePath} is not a file inside the repository at ${root}`,
      "Pass a path to a markdown file inside the repository."
    );
  }
  return relativePath.split(path.sep).join("/");
}
