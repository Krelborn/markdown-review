/**
 * Puts each of a rendered doc's tables in the tab order, so a keyboard can scroll one that is wider than the column
 *
 * @param container the rendered doc
 */
export function makeTablesFocusable(container: ParentNode): void {
  for (const table of container.querySelectorAll("table")) {
    table.setAttribute("tabindex", "0");
  }
}
