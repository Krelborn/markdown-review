import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * Counts the times the doc's layout has changed size, so measurements of what it holds can be taken again
 *
 * @returns a number that changes whenever the content or the frame round the view changes size
 */
export function useLayoutRevision(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): number {
  const [layoutRevision, setLayoutRevision] = useState(0);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null) {
      return;
    }
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observeLayout(observer, view, content);
    return () => observer.disconnect();
  }, [contentRef, viewRef]);
  return layoutRevision;
}

/**
 * Observes what lays out the doc's blocks: the content, and the frame round the view, whose width sets how far wide
 * blocks reach past the prose, so they can change width while the content keeps its size
 */
export function observeLayout(observer: ResizeObserver, view: HTMLElement, content: HTMLElement): void {
  observer.observe(content);
  if (view.parentElement !== null) {
    observer.observe(view.parentElement);
  }
}
