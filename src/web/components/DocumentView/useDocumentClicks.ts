import type { RefObject } from "react";
import { useEffect } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { offsetAtPoint } from "../../anchoring/offsetAtPoint";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { threadAtOffset } from "../../review/threadAtOffset";

import { copyHeadingLink } from "./copyHeadingLink";
import type { RenderedDocument } from "./useRenderedDocument";

export interface DocumentClickHandlers {
  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;
}

/**
 * Handles clicks in the rendered doc: a link to a heading scrolls to it, a link to another doc shows that doc in the
 * page, and a click on highlighted text selects its thread
 *
 * @param highlightedThreads the threads whose passages are highlighted
 */
export function useDocumentClicks(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  highlightedThreads: readonly Thread[],
  { onNavigate, onSelectThread }: DocumentClickHandlers
): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null) {
      return;
    }
    const click = (event: MouseEvent): void => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link !== null) {
        followLink(event, content, link.getAttribute("href") ?? "", onNavigate);
        if (link.hasAttribute("data-heading-link")) {
          copyHeadingLink(link);
        }
        return;
      }
      const offset =
        document.getSelection()?.isCollapsed === false
          ? null
          : offsetAtPoint(content, rendered.documentText, event.clientX, event.clientY);
      const thread = offset === null ? null : threadAtOffset(highlightedThreads, offset);
      if (thread !== null) {
        onSelectThread(thread.id);
      }
    };
    content.addEventListener("click", click);
    return () => content.removeEventListener("click", click);
  }, [contentRef, highlightedThreads, onNavigate, onSelectThread, rendered]);
}

/**
 * Scrolls to the doc's heading that a link such as "#retry-policy" names, and puts it in the page's address
 *
 * @param hash the fragment; one that is not valid percent-encoding is matched as written
 */
export function scrollToHeading(content: HTMLElement, hash: string): void {
  const id = decodeFragment(hash.slice(1));
  [...content.querySelectorAll("[id]")].find((element) => element.id === id)?.scrollIntoView();
  history.replaceState(history.state, "", hash);
}

function followLink(
  event: MouseEvent,
  content: HTMLElement,
  href: string,
  onNavigate: (pagePath: string) => void
): void {
  if (href.startsWith("#")) {
    event.preventDefault();
    scrollToHeading(content, href);
  } else if (href.startsWith("/document/") && isPlainLeftClick(event)) {
    event.preventDefault();
    onNavigate(href);
  }
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}
