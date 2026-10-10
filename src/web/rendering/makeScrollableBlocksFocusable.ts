/**
 * Puts each of a rendered doc's tables and code blocks in the tab order, so a keyboard can scroll one that is wider than
 * the room it has. Its code blocks are the `pre`s that `DocumentView.module.css` scrolls.
 *
 * @param container the rendered doc
 */
export function makeScrollableBlocksFocusable(container: ParentNode): void {
  for (const block of container.querySelectorAll("table, div[data-md-block] > pre")) {
    block.setAttribute("tabindex", "0");
  }
}
