import { parseDocument } from "yaml";

const frontmatterPattern = /^---\r?\n(?<frontmatter>[\s\S]*?\r?\n)---\r?\n/u;

/**
 * @param skill the bundled skill
 * @param version the running markdown-review's version
 * @returns the skill as `install-skill` writes it, with the version that wrote it in its frontmatter's
 *   `metadata.version`
 * @throws when the skill has no frontmatter
 */
export function stampSkill(skill: string, version: string): string {
  const match = frontmatterPattern.exec(skill);
  const frontmatter = match?.groups?.frontmatter;
  if (match === null || frontmatter === undefined) {
    throw new TypeError("The skill has no frontmatter to stamp");
  }
  const document = parseDocument(frontmatter);
  document.setIn(["metadata", "version"], version);
  return `---\n${document.toString({ lineWidth: 0 })}---\n${skill.slice(match[0].length)}`;
}

/**
 * @param installed an installed copy of the skill
 * @returns the version that installed it, or null when the copy carries none
 */
export function readSkillStamp(installed: string): string | null {
  const frontmatter = frontmatterPattern.exec(installed)?.groups?.frontmatter;
  if (frontmatter === undefined) {
    return null;
  }
  const version = parseDocument(frontmatter).getIn(["metadata", "version"]);
  return typeof version === "string" ? version : null;
}
