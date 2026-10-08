import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const runCommand = promisify(execFile);

/**
 * Creates a git repository in a new temporary directory, holding the given docs
 *
 * @param documents each doc's source, by repo-relative path
 * @returns the repository's root, with symbolic links resolved as git resolves them
 */
export async function createGitRepository(documents: Record<string, string>): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "markdown-review-test-")));
  for (const [document, source] of Object.entries(documents)) {
    const filePath = path.join(root, ...document.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source);
  }
  await runCommand("git", ["init", "-q"], { cwd: root });
  return root;
}
