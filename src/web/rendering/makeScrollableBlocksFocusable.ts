/**
 * Puts each of a rendered doc's tables and code blocks in the tab order, so a keyboard can scroll one that is wider than
 * the room it has
 *
 * @param container the rendered doc
 */
export function makeScrollableBlocksFocusable(container: ParentNode): void {
  for (const block of container.querySelectorAll("table, [data-md-block] > pre")) {
    block.setAttribute("tabindex", "0");
  }
}
