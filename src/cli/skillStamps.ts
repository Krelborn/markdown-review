const stampPattern = /^<!-- markdown-review (?<version>\S+) -->$/mu;

/**
 * @param skill the bundled skill
 * @param version the running markdown-review's version
 * @returns the skill as `install-skill` writes it, marked with the version that wrote it
 */
export function stampSkill(skill: string, version: string): string {
  return `${skill}\n<!-- markdown-review ${version} -->\n`;
}

/**
 * @param installed an installed copy of the skill
 * @returns the version that installed it, or null when the copy carries no stamp
 */
export function readSkillStamp(installed: string): string | null {
  return stampPattern.exec(installed)?.groups?.version ?? null;
}
