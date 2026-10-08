import type { DocumentText } from "../../shared/markdown/DocumentText";
import { contextLength } from "../../shared/review/anchorSchema";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

/**
 * Builds the anchor a new comment on a passage of a doc's canonical text sends to the server
 *
 * @param documentText the doc's canonical text
 * @param documentPath the doc's repo-relative path
 * @param startOffset where the passage starts
 * @param endOffset where it ends, exclusive
 * @returns the anchor, with up to 32 characters of context either side
 */
export function passageAnchor(
  documentText: DocumentText,
  documentPath: string,
  startOffset: number,
  endOffset: number
): NewPassageAnchor {
  const { text } = documentText;
  return {
    document: documentPath,
    endOffset,
    kind: "passage",
    prefix: text.slice(Math.max(0, startOffset - contextLength), startOffset),
    quote: text.slice(startOffset, endOffset),
    startOffset,
    suffix: text.slice(endOffset, endOffset + contextLength),
  };
}
