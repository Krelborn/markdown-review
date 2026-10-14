/**
 * Finds the box a node scrolls in
 *
 * @returns the node's nearest ancestor that scrolls up and down, or null when only the page scrolls it
 */
export function scrollingAncestor(node: Node): Element | null {
  for (let ancestor = node.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const { overflowY } = getComputedStyle(ancestor);
    if (overflowY === "auto" || overflowY === "scroll") {
      return ancestor;
    }
  }
  return null;
}
