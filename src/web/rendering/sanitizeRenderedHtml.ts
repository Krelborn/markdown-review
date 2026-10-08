import DOMPurify from "dompurify";

/**
 * Removes scripts and other active content from a rendered doc before it is inserted into the page
 *
 * @param html the HTML markdown-it rendered
 * @returns the HTML that is safe to insert; block attributes, task-list checkboxes and labels are kept
 */
export function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
