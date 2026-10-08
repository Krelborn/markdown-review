/**
 * Reads the language of a fenced code block from its info string
 *
 * @param info the text after the opening fence, e.g. "ts title=example"
 * @returns the first word of the info string, or an empty string when there is none
 */
export function fenceLanguage(info: string): string {
  return info.trim().split(/\s+/)[0] ?? "";
}
