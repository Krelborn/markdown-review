import path from "node:path";

/**
 * @param base the repo root, or the home directory for a global install
 * @returns where `install-skill` writes the skill under that directory
 */
export function skillInstallPath(base: string): string {
  return path.join(base, ".claude", "skills", "markdown-review", "SKILL.md");
}
