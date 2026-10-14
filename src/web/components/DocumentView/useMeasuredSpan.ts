import type { RefObject } from "react";
import { useLayoutEffect, useState } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { measureSpan } from "./measureSpan";
import type { SpanBox } from "./SpanBox";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Measures a run of the rendered doc's blocks, again whenever the layout or the rendering changes
 *
 * @param span the blocks, or null
 * @returns where the blocks are, or null when there is no span, no rendering or no such blocks
 */
export function useMeasuredSpan(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  span: BlockSpan | null
): SpanBox | null {
  const [box, setBox] = useState<SpanBox | null>(null);
  const layoutRevision = useLayoutRevision(viewRef, contentRef);
  const firstBlock = span?.firstBlock ?? null;
  const lastBlock = span?.lastBlock ?? null;
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    const canMeasure = view !== null && content !== null && rendered !== null;
    setBox(
      canMeasure && firstBlock !== null && lastBlock !== null
        ? measureSpan(view, content, { firstBlock, lastBlock })
        : null
    );
  }, [contentRef, firstBlock, lastBlock, layoutRevision, rendered, viewRef]);
  return box;
}
