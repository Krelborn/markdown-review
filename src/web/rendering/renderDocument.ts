import { createMarkdownIt } from "../../shared/markdown/createMarkdownIt";

import { addHeadingIds } from "./addHeadingIds";
import { findFenceLanguages } from "./findFenceLanguages";
import { loadHighlight } from "./loadHighlight";
import { pointLinksAtReview } from "./pointLinksAtReview";
import { sanitizeRenderedHtml } from "./sanitizeRenderedHtml";

/**
 * Renders a doc for the review page
 *
 * @param source the doc's markdown
 * @param documentPath the doc's repo-relative path
 * @returns sanitized HTML whose leaf block elements carry `data-md-block`, `data-md-start` and `data-md-end`, with
 *   fenced code highlighted, headings given GitHub's ids, and links and images pointed at the review app
 */
export async function renderDocument(source: string, documentPath: string): Promise<string> {
  const highlight = await loadHighlight(findFenceLanguages(source));
  const template = document.createElement("template");
  template.innerHTML = sanitizeRenderedHtml(createMarkdownIt({ highlight }).render(source));
  addHeadingIds(template.content);
  pointLinksAtReview(template.content, documentPath);
  return template.innerHTML;
}
