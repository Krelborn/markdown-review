import type { DocumentText } from "../../shared/markdown/DocumentText";

import { offsetInDocument } from "./offsetInDocument";
import type { PagePoint } from "./PagePoint";

/**
 * Finds the character of a rendered doc under a point on the screen, as a click on a highlight gives it
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param x the point's distance from the viewport's left edge
 * @param y its distance from the viewport's top edge
 * @returns the offset in the canonical text, or null when the point is on no text of the doc
 */
export function offsetAtPoint(container: Element, documentText: DocumentText, x: number, y: number): number | null {
  const caret = caretAt(container.ownerDocument, x, y);
  if (caret === null || !container.contains(caret.node)) {
    return null;
  }
  return offsetInDocument(container, documentText, caret, "start");
}

function caretAt(document: Document, x: number, y: number): PagePoint | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    return position === null ? null : { node: position.offsetNode, offset: position.offset };
  }
  // Safari before 26.2 has only the older call
  const range = document.caretRangeFromPoint(x, y);
  return range === null ? null : { node: range.startContainer, offset: range.startOffset };
}
