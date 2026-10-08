import DOMPurify from "dompurify";

/**
 * Removes scripts and other active content from a rendered doc before it is inserted into the page
 *
 * @param html the HTML markdown-it rendered
 * @returns the HTML that is safe to insert; block attributes, task-list checkboxes and labels are kept, while forms
 *   and style elements are removed so a doc can neither post to the server nor restyle the app
 */
export function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["form", "style"] });
}
