import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import skill from "../../../skills/markdown-review/SKILL.md?raw";
import { readTextFileOrNull } from "../../server/files/readTextFileOrNull";
import { packageVersion } from "../../server/runtime/packageVersion";
import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { findRoot } from "../findRoot";
import type { SkillDirectory } from "../skillDirectories";
import { skillDirectories, skillInstallPath } from "../skillDirectories";
import { stampSkill } from "../skillStamps";

/**
 * Writes the skill that teaches agents the review workflow into `.claude/skills`, which Claude Code reads, and
 * `.agents/skills`, which Codex, Gemini CLI and most other agents read, under the repo root or, with `--global`, the
 * home directory; `--only claude` or `--only agents` writes just that copy
 */
export async function installSkillCommand(args: string[], { terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { global: { type: "boolean" }, only: { type: "string" } } });
  const directories = selectDirectories(values.only);
  const base = values.global === true ? (terminal.env.HOME ?? os.homedir()) : await findRoot(terminal.workingDirectory);
  const stamped = stampSkill(skill, packageVersion);
  const outcomes = await Promise.all(
    directories.map((directory) => writeSkill(skillInstallPath(base, directory), stamped))
  );
  terminal.stdout(
    `${outcomes.join("")}\n` +
      "next_step: The skill loads when an agent session starts. To start a review now, run `markdown-review open <doc.md>`.\n"
  );
  return 0;
}

function selectDirectories(only: string | undefined): readonly SkillDirectory[] {
  if (only === undefined) {
    return skillDirectories;
  }
  const directory = skillDirectories.find((candidate) => candidate === only);
  if (directory === undefined) {
    throw new CliError(
      `--only must be claude or agents, not "${only}"`,
      "Run `markdown-review install-skill --only claude` or `--only agents`, or leave out --only to install both.",
      2
    );
  }
  return [directory];
}

/**
 * @param skillPath where to write the skill
 * @param stamped the skill to write
 * @returns the line that says whether the skill was installed, reinstalled or updated there
 */
async function writeSkill(skillPath: string, stamped: string): Promise<string> {
  const installed = await readTextFileOrNull(skillPath);
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, stamped);
  const outcome = installed === null ? "Installed" : installed === stamped ? "Reinstalled" : "Updated";
  return `${outcome} the markdown-review skill at ${skillPath}\n`;
}
