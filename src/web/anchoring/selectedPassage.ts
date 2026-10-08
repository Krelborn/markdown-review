import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import { offsetInDocument } from "./offsetInDocument";
import { passageAnchor } from "./passageAnchor";

/**
 * Turns the user's selection in a rendered doc into the anchor of a new comment
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param documentPath the doc's repo-relative path
 * @param selection the selected range
 * @returns the anchor of the selected text without whitespace at either end, or null when the selection holds no
 *   text of the doc
 */
export function selectedPassage(
  container: Element,
  documentText: DocumentText,
  documentPath: string,
  selection: Range
): NewPassageAnchor | null {
  if (selection.collapsed || !selection.intersectsNode(container)) {
    return null;
  }
  const start = { node: selection.startContainer, offset: selection.startOffset };
  const end = { node: selection.endContainer, offset: selection.endOffset };
  let startOffset = offsetInDocument(container, documentText, start, "start");
  let endOffset = offsetInDocument(container, documentText, end, "end");
  if (startOffset === null || endOffset === null) {
    return null;
  }
  const { text } = documentText;
  while (startOffset < endOffset && /\s/.test(text.charAt(startOffset))) {
    startOffset += 1;
  }
  while (endOffset > startOffset && /\s/.test(text.charAt(endOffset - 1))) {
    endOffset -= 1;
  }
  return startOffset === endOffset ? null : passageAnchor(documentText, documentPath, startOffset, endOffset);
}
