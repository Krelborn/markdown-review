import path from "node:path";

/**
 * The skills directories `install-skill` writes to, `.claude/skills` and `.agents/skills`, by the names `--only` takes
 */
export const skillDirectories = ["claude", "agents"] as const;

export type SkillDirectory = (typeof skillDirectories)[number];

/**
 * @param base the repo root, or the home directory for a global install
 * @param directory the skills directory under that base
 * @returns where `install-skill` writes the skill in that skills directory
 */
export function skillInstallPath(base: string, directory: SkillDirectory): string {
  return path.join(base, `.${directory}`, "skills", "markdown-review", "SKILL.md");
}
