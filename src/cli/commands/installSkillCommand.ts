import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import skill from "../../../skills/markdown-review/SKILL.md?raw";
import { readTextFileOrNull } from "../../server/files/readTextFileOrNull";
import type { CliContext } from "../CliContext";
import { findRoot } from "../findRoot";

/**
 * Writes the skill that teaches agents the review workflow where Claude Code and OpenCode look for skills
 */
export async function installSkillCommand(args: string[], { terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { global: { type: "boolean" } } });
  const base = values.global === true ? (terminal.env.HOME ?? os.homedir()) : await findRoot(terminal.workingDirectory);
  const skillPath = path.join(base, ".claude", "skills", "markdown-review", "SKILL.md");
  const installed = await readTextFileOrNull(skillPath);
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, skill);
  const outcome = installed === null ? "Installed" : installed === skill ? "Reinstalled" : "Updated";
  terminal.stdout(
    `${outcome} the markdown-review skill at ${skillPath}\n\n` +
      "next_step: The skill loads when an agent session starts. To start a review now, run `markdown-review open <doc.md>`.\n"
  );
  return 0;
}
