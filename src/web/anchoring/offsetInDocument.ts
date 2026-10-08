import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { BlockTextLayout } from "../rendering/BlockTextLayout";
import { layOutBlockText } from "../rendering/layOutBlockText";

import { blockElementAt } from "./blockElementAt";
import type { PagePoint } from "./PagePoint";

/**
 * Which end of a passage a point is
 */
export type PassageEdge = "start" | "end";

/**
 * Finds where a point in a rendered doc falls in the doc's canonical text
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param point the point, as a DOM Range or caret gives it
 * @param edge which end of a passage the point is: a point outside every block moves forward to the next block's start
 *   when it starts a passage, and back to the previous block's end when it ends one, and a point in a block that takes
 *   whole-block comments only moves to that block's start or end the same way
 * @returns the offset in the canonical text, or null when no block lies in that direction
 */
export function offsetInDocument(
  container: Element,
  documentText: DocumentText,
  { node, offset }: PagePoint,
  edge: PassageEdge
): number | null {
  const element = blockElementAt(container, node);
  const blockElement = element ?? nearestBlockElement(container, { node, offset }, edge);
  if (blockElement === undefined) {
    return null;
  }
  const index = Number(blockElement.getAttribute("data-md-block"));
  const block = documentText.blocks[index];
  const blockStart = documentText.blockStartOffsets[index];
  if (block === undefined || blockStart === undefined) {
    return null;
  }
  if (element === null || block.wholeBlockOnly) {
    return edge === "start" ? blockStart : blockStart + block.text.length;
  }
  return blockStart + offsetInBlock(container.ownerDocument, layOutBlockText(blockElement), { node, offset });
}

function nearestBlockElement(container: Element, point: PagePoint, edge: PassageEdge): Element | undefined {
  const pointRange = container.ownerDocument.createRange();
  pointRange.setStart(point.node, point.offset);
  const blockElements = [...container.querySelectorAll("[data-md-block]")];
  return edge === "start"
    ? blockElements.find((element) => pointRange.comparePoint(element, 0) >= 0)
    : blockElements.findLast((element) => pointRange.comparePoint(element, element.childNodes.length) <= 0);
}

function offsetInBlock(document: Document, layout: BlockTextLayout, { node, offset }: PagePoint): number {
  const segment = layout.segments.find((candidate) => candidate.node === node);
  if (segment !== undefined) {
    return segment.offset + Math.min(offset, segment.node.length);
  }
  const pointRange = document.createRange();
  pointRange.setStart(node, offset);
  const next = layout.segments.find((candidate) => pointRange.comparePoint(candidate.node, 0) >= 0);
  return next?.offset ?? layout.text.length;
}
