import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * Counts the times an element has changed size, so measurements of what it holds can be taken again
 *
 * @returns a number that changes whenever the element's size does
 */
export function useLayoutRevision(elementRef: RefObject<HTMLElement | null>): number {
  const [layoutRevision, setLayoutRevision] = useState(0);
  useEffect(() => {
    const element = elementRef.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);
  return layoutRevision;
}
