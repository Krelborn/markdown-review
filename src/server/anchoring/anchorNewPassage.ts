import { createDocumentText } from "../../shared/markdown/createDocumentText";
import { linesForRange } from "../../shared/markdown/linesForRange";
import type { PassageAnchor } from "../../shared/review/anchorSchema";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";
import { hashSource } from "../store/hashSource";

import { reanchorPassage } from "./reanchorPassage";

/**
 * Anchors a passage the user has just selected
 *
 * @param newAnchor the selection, as offsets and text in the doc the browser rendered
 * @param source the doc's current source
 * @param renderedHash the hash of the source the browser rendered, if it sent one
 * @returns the anchor at the selected offsets when the browser rendered the current source, otherwise the anchor
 *   re-anchored against the current source
 */
export function anchorNewPassage(newAnchor: NewPassageAnchor, source: string, renderedHash?: string): PassageAnchor {
  const documentText = createDocumentText(source);
  const { endOffset, quote, startOffset } = newAnchor;
  const anchor: PassageAnchor = {
    ...newAnchor,
    ...linesForRange(documentText, startOffset, endOffset),
    anchoredText: quote,
    outdated: false,
  };
  const isCurrent = renderedHash === hashSource(source) && documentText.text.slice(startOffset, endOffset) === quote;
  return isCurrent ? anchor : reanchorPassage(anchor, documentText);
}
