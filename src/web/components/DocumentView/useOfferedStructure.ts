import type { RefObject } from "react";

import type { DocumentStructure } from "../../../shared/markdown/DocumentStructure";
import { innermostStructure } from "../../anchoring/innermostStructure";

import type { SpanBox } from "./SpanBox";
import { useMeasuredSpan } from "./useMeasuredSpan";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * The structure the gutter offers a comment on, and where it is
 */
export interface OfferedStructure {
  box: SpanBox;
  structure: DocumentStructure;
}

/**
 * Follows the structure the gutter offers beside a block, measured again whenever the layout changes
 *
 * @param blockIndex the block the gutter picks, or null when it picks none
 * @returns the innermost structure around the block, or null when there is no block or no structure holds it
 */
export function useOfferedStructure(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  blockIndex: number | null
): OfferedStructure | null {
  const structure =
    rendered === null || blockIndex === null ? null : innermostStructure(rendered.documentText, blockIndex);
  const box = useMeasuredSpan(viewRef, contentRef, rendered, structure);
  return structure === null || box === null ? null : { box, structure };
}
