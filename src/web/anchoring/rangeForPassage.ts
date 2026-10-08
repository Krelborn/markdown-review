import { blockAtOffset } from "../../shared/markdown/blockAtOffset";
import type { DocumentText } from "../../shared/markdown/DocumentText";
import { layOutBlockText } from "../rendering/layOutBlockText";

import type { PassageEdge } from "./offsetInDocument";
import type { PagePoint } from "./PagePoint";

/**
 * Finds the part of a rendered doc that a passage of its canonical text covers
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 * @returns a range over the passage's text, which covers the whole of any block that takes whole-block comments only,
 *   or null when the doc has no blocks
 */
export function rangeForPassage(
  container: Element,
  documentText: DocumentText,
  startOffset: number,
  endOffset: number
): Range | null {
  const start = pointAt(container, documentText, startOffset, "start");
  const end = pointAt(container, documentText, Math.max(startOffset, endOffset - 1), "end");
  if (start === null || end === null) {
    return null;
  }
  const range = container.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/**
 * @param offset for the start edge, the first character of the passage; for the end edge, its last character
 */
function pointAt(container: Element, documentText: DocumentText, offset: number, edge: PassageEdge): PagePoint | null {
  const position = blockAtOffset(documentText, offset);
  const index = position === null ? -1 : documentText.blocks.indexOf(position.block);
  const element = container.querySelector(`[data-md-block="${index}"]`);
  if (position === null || element === null) {
    return null;
  }
  const atBlockEdge =
    edge === "start" ? { node: element, offset: 0 } : { node: element, offset: element.childNodes.length };
  if (position.block.wholeBlockOnly) {
    return atBlockEdge;
  }
  const { segments } = layOutBlockText(element);
  const characterOffset = position.offsetInBlock;
  const segment =
    edge === "start"
      ? segments.find((candidate) => characterOffset < candidate.offset + candidate.node.length)
      : segments.findLast((candidate) => characterOffset >= candidate.offset);
  if (segment === undefined) {
    return atBlockEdge;
  }
  const offsetInNode = characterOffset - segment.offset + (edge === "start" ? 0 : 1);
  return { node: segment.node, offset: Math.min(Math.max(offsetInNode, 0), segment.node.length) };
}
