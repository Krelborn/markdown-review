import type { RefObject } from "react";
import { useEffect } from "react";

import { hasMermaidDiagrams, renderMermaidDiagrams } from "../../rendering/renderMermaidDiagrams";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Draws the Mermaid diagrams of each new rendering of the doc once it is in the page, and draws them again in the new
 * colours when the system switches between light and dark mode
 */
export function useMermaidDiagrams(contentRef: RefObject<HTMLElement | null>, rendered: RenderedDocument | null): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null || !hasMermaidDiagrams(content)) {
      return;
    }
    const draw = (): void => {
      renderMermaidDiagrams(content).catch((failure: unknown) => reportError(failure));
    };
    draw();
    const darkMode = matchMedia("(prefers-color-scheme: dark)");
    darkMode.addEventListener("change", draw);
    return () => darkMode.removeEventListener("change", draw);
  }, [contentRef, rendered]);
}
