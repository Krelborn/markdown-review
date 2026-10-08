/**
 * Finds the rendered block a node is in
 *
 * @param container the element the rendered doc was inserted into
 * @param node a node of the page
 * @returns the element carrying the block's `data-md-block`, or null when the node is in no block of the container
 */
export function blockElementAt(container: Element, node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  const blockElement = element?.closest("[data-md-block]") ?? null;
  return blockElement !== null && container.contains(blockElement) ? blockElement : null;
}
