import type { RefObject } from "react";
import { useEffect } from "react";

import { renderMermaidDiagrams } from "../../rendering/renderMermaidDiagrams";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Draws the Mermaid diagrams of each new rendering of the doc once it is in the page
 */
export function useMermaidDiagrams(contentRef: RefObject<HTMLElement | null>, rendered: RenderedDocument | null): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content !== null && rendered !== null) {
      renderMermaidDiagrams(content).catch((failure: unknown) => reportError(failure));
    }
  }, [contentRef, rendered]);
}
