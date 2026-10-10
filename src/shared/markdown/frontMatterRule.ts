import type { StateBlock } from "markdown-it";

const openingFence = "---";

const closingFences = new Set(["---", "..."]);

/**
 * Recognises YAML frontmatter: a `---` line that starts the doc and is followed by a line that is not blank, through the
 * next `---` or `...` line
 *
 * @returns whether the doc starts with frontmatter; when it does and `silent` is false, the rule adds a `front_matter`
 *   token holding the lines between the fences
 */
export function frontMatterRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (startLine !== 0 || state.parentType !== "root" || lineAt(state, 0).trimEnd() !== openingFence) {
    return false;
  }
  if (state.isEmpty(1)) {
    return false;
  }
  const closingLine = findClosingLine(state, endLine);
  if (closingLine === null) {
    return false;
  }
  if (!silent) {
    const token = state.push("front_matter", "", 0);
    token.content = state.getLines(1, closingLine, 0, true);
    token.map = [0, closingLine + 1];
    token.markup = openingFence;
    state.line = closingLine + 1;
  }
  return true;
}

function findClosingLine(state: StateBlock, endLine: number): number | null {
  for (let line = 1; line < endLine; line++) {
    if (closingFences.has(lineAt(state, line).trimEnd())) {
      return line;
    }
  }
  return null;
}

function lineAt(state: StateBlock, line: number): string {
  return state.getLines(line, line + 1, 0, false);
}
