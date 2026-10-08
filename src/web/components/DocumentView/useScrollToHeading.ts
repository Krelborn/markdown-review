import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { scrollToHeading } from "./useDocumentClicks";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Scrolls to the heading the page's address names once the doc first renders, and not again when the doc renders
 * anew after an edit, which keeps the user's place
 *
 * @param hash the address's fragment, such as "#goals", or an empty string
 */
export function useScrollToHeading(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  documentPath: string,
  hash: string
): void {
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    const heading = documentPath + hash;
    if (content === null || rendered === null || hash === "" || heading === scrolledTo.current) {
      return;
    }
    scrolledTo.current = heading;
    scrollToHeading(content, hash);
  }, [contentRef, documentPath, hash, rendered]);
}
