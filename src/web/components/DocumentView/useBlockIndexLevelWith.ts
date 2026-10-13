import type { RefObject } from "react";
import { useCallback, useRef } from "react";

import type { BlockBox } from "./BlockBox";
import { blockLevelWith } from "./blockLevelWith";
import { measureBlock } from "./measureBlock";
import { useLayoutRevision } from "./useLayoutRevision";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * The doc's blocks, as measured for a layout and a rendering of the doc
 */
interface MeasuredBlocks {
  boxes: BlockBox[];
  layoutRevision: number;
  rendered: RenderedDocument | null;
}

/**
 * Finds the block level with a distance down the page, as the gutter picks it
 *
 * @returns a function from a distance down the page to the index of the block level with it, or to null when no block
 *   takes up any height
 */
export function useBlockIndexLevelWith(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null
): (clientY: number) => number | null {
  const layoutRevision = useLayoutRevision(viewRef, contentRef);
  const measured = useRef<MeasuredBlocks | null>(null);
  return useCallback(
    (clientY: number): number | null => {
      const view = viewRef.current;
      const content = contentRef.current;
      if (view === null || content === null) {
        return null;
      }
      if (measured.current?.layoutRevision !== layoutRevision || measured.current.rendered !== rendered) {
        const boxes = [...content.querySelectorAll("[data-md-block]")].map((block) => measureBlock(view, block));
        measured.current = { boxes, layoutRevision, rendered };
      }
      return blockLevelWith(measured.current.boxes, clientY - view.getBoundingClientRect().top)?.index ?? null;
    },
    [contentRef, layoutRevision, rendered, viewRef]
  );
}
