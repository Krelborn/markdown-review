import type { BlockTextLayout } from "./BlockTextLayout";

const ignoredSelector = "[data-md-ignore]";

/**
 * Reads the canonical text of a rendered block element, in the form `parseBlocks` gives it
 *
 * @param blockElement the element carrying the block's `data-md-block` attribute
 * @returns the block's text and where each of its text nodes starts in that text; elements marked
 *   `data-md-ignore` contribute nothing, and a table row's cells are separated by "\t"
 */
export function layOutBlockText(blockElement: Element): BlockTextLayout {
  const layout: BlockTextLayout = { segments: [], text: "" };
  if (blockElement.tagName !== "TR") {
    appendTextNodes(blockElement, layout);
    return layout;
  }
  const cells = Array.from(blockElement.children).filter((cell) => !cell.matches(ignoredSelector));
  cells.forEach((cell, cellIndex) => {
    if (cellIndex > 0) {
      layout.text += "\t";
    }
    appendTextNodes(cell, layout);
  });
  return layout;
}

function appendTextNodes(root: Element, layout: BlockTextLayout): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Text && node.parentElement?.closest(ignoredSelector) === null) {
      layout.segments.push({ node, offset: layout.text.length });
      layout.text += node.data;
    }
  }
}
