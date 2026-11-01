import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { MarkdownBlock } from "../../shared/markdown/MarkdownBlock";
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
 *   whole-block comments only moves to that block's start or end the same way, unless the point touches the block
 *   without holding any of it: a start at the block's end moves on to the next block's start, and an end at the
 *   block's start moves back to the previous block's end
 * @returns the offset in the canonical text, or null when no block lies in that direction
 */
export function offsetInDocument(
  container: Element,
  documentText: DocumentText,
  point: PagePoint,
  edge: PassageEdge
): number | null {
  return locate(container, documentText, point, edge, true);
}

/**
 * Finds the character of a rendered doc a pointer is over, from the caret position the browser reports there
 *
 * Unlike a selection's start, a caret at the end of a block that takes whole-block comments only, as the browser puts
 * it when the pointer is on the right half of an image, is over that block.
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param point the caret position
 * @returns the offset in the canonical text, or null when no block lies after the point
 */
export function offsetUnderPointer(container: Element, documentText: DocumentText, point: PagePoint): number | null {
  return locate(container, documentText, point, "start", false);
}

function locate(
  container: Element,
  documentText: DocumentText,
  point: PagePoint,
  edge: PassageEdge,
  leavesTouchedBlock: boolean
): number | null {
  const found = findBlock(container, documentText, point, edge);
  if (found === null) {
    return null;
  }
  const { block, blockElement, blockStart, index, isInBlock } = found;
  if (isInBlock && !block.wholeBlockOnly) {
    return blockStart + offsetInBlock(container.ownerDocument, layOutBlockText(blockElement), point);
  }
  if (isInBlock && leavesTouchedBlock && touchesBlockEdge(blockElement, point, edge)) {
    return neighbouringEdge(documentText, index, edge);
  }
  return blockStart + (edge === "start" ? 0 : block.text.length);
}

interface FoundBlock {
  block: MarkdownBlock;
  blockElement: Element;
  blockStart: number;
  index: number;

  /**
   * False when the point is outside every block, so that the block is the nearest one in the passage's direction
   */
  isInBlock: boolean;
}

function findBlock(
  container: Element,
  documentText: DocumentText,
  point: PagePoint,
  edge: PassageEdge
): FoundBlock | null {
  const element = blockElementAt(container, point.node);
  const blockElement = element ?? nearestBlockElement(container, point, edge);
  const index = Number(blockElement?.getAttribute("data-md-block"));
  const block = documentText.blocks[index];
  const blockStart = documentText.blockStartOffsets[index];
  if (blockElement === undefined || block === undefined || blockStart === undefined) {
    return null;
  }
  return { block, blockElement, blockStart, index, isInBlock: element !== null };
}

/**
 * @returns whether a start point is at the end of the block, or an end point at its start
 */
function touchesBlockEdge(blockElement: Element, point: PagePoint, edge: PassageEdge): boolean {
  return isAtEdge(blockElement, point, edge === "start" ? "last" : "first");
}

/**
 * @returns where the passage starts in the block after the one at `index`, or ends in the block before it
 */
function neighbouringEdge(documentText: DocumentText, index: number, edge: PassageEdge): number | null {
  if (edge === "start") {
    return documentText.blockStartOffsets[index + 1] ?? null;
  }
  const previous = documentText.blocks[index - 1];
  const previousStart = documentText.blockStartOffsets[index - 1];
  return previous === undefined || previousStart === undefined ? null : previousStart + previous.text.length;
}

/**
 * @returns whether nothing of the block lies before the point when `side` is "first", or after it when it is "last"
 */
function isAtEdge(blockElement: Element, { node, offset }: PagePoint, side: "first" | "last"): boolean {
  let current = node;
  let position = offset;
  while (current !== blockElement) {
    if (position !== (side === "first" ? 0 : lengthOf(current))) {
      return false;
    }
    const parent = current.parentNode;
    if (parent === null) {
      return false;
    }
    position = [...parent.childNodes].indexOf(current as ChildNode) + (side === "first" ? 0 : 1);
    current = parent;
  }
  return position === (side === "first" ? 0 : blockElement.childNodes.length);
}

function lengthOf(node: Node): number {
  return node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length;
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
