import type { Token } from "markdown-it";

const phrasingTagNames = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "img",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

/**
 * Tells whether a paragraph or heading holds inline HTML that the browser may move out of the block, or that the
 * sanitizer may remove with its content, so the rendered text can differ from the canonical text
 *
 * @param children the children of the block's inline token
 * @returns true when an inline HTML tag is not one of the phrasing elements such as `span`, `b` or `a`
 */
export function hasStructuralHtml(children: readonly Token[]): boolean {
  return children.some((child) => {
    if (child.type !== "html_inline") {
      return false;
    }
    const tagName = /^<\/?([a-z][a-z0-9-]*)/i.exec(child.content)?.[1];
    return tagName !== undefined && !phrasingTagNames.has(tagName.toLowerCase());
  });
}
