import type { RefObject } from "react";
import { useEffect } from "react";

import { useColorScheme } from "../../appearance/useColorScheme";
import { hasMermaidDiagrams, renderMermaidDiagrams } from "../../rendering/renderMermaidDiagrams";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Draws the Mermaid diagrams of each new rendering of the doc once it is in the page, and draws them again in the new
 * colours when the page switches between light and dark mode
 */
export function useMermaidDiagrams(contentRef: RefObject<HTMLElement | null>, rendered: RenderedDocument | null): void {
  const colorScheme = useColorScheme();
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null || !hasMermaidDiagrams(content)) {
      return;
    }
    renderMermaidDiagrams(content, colorScheme).catch((failure: unknown) => reportError(failure));
  }, [colorScheme, contentRef, rendered]);
}
