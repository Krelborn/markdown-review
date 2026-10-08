import type { Token } from "markdown-it";

export interface InlineText {
  text: string;

  /**
   * The offset in `text` where each source line after the first starts
   */
  lineStartOffsets: number[];
}

const textTokenTypes = new Set(["text", "text_special", "code_inline"]);

const lineBreakTokenTypes = new Set(["softbreak", "hardbreak"]);

/**
 * Reads the canonical text of a paragraph, heading or table cell
 *
 * @param children the children of the block's inline token
 * @returns the text as the browser shows it, with each line break as "\n"; images and HTML tags contribute nothing
 */
export function inlineText(children: readonly Token[]): InlineText {
  let text = "";
  const lineStartOffsets: number[] = [];
  for (const child of children) {
    if (textTokenTypes.has(child.type)) {
      text += child.content;
    } else if (lineBreakTokenTypes.has(child.type)) {
      text += "\n";
      lineStartOffsets.push(text.length);
    }
  }
  return { lineStartOffsets, text };
}
