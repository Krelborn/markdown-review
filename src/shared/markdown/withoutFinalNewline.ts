/**
 * Removes one trailing newline, as markdown-it leaves on the content of code and HTML blocks
 *
 * @param content the block content
 * @returns the content without its final newline
 */
export function withoutFinalNewline(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content;
}
