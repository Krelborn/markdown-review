import { tasklist } from "@mdit/plugin-tasklist";
import markdownIt from "markdown-it";
import type { MarkdownIt } from "markdown-it";

/**
 * Creates the markdown-it instance the server and the browser share, so both find the same blocks
 *
 * @returns an instance that allows raw HTML and renders task lists
 */
export function createMarkdownIt(): MarkdownIt {
  return new markdownIt({ html: true }).use(tasklist);
}
