import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

export interface PageLocation {
  /**
   * The address's fragment, such as "#goals", or an empty string
   */
  hash: string;

  pathname: string;
}

export interface PageNavigation {
  location: PageLocation;

  /**
   * Shows another page of the app without reloading, as a new entry in the browser's history, from the top of the
   * page's content
   *
   * @param pagePath the page's path, with any fragment
   */
  navigate: (pagePath: string) => void;
}

/**
 * Follows the page's address, including the browser's back and forward buttons
 *
 * @param scrollContainerRef the element the page's content scrolls in
 */
export function usePageLocation(scrollContainerRef: RefObject<HTMLElement | null>): PageNavigation {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = (): void => setLocation(readLocation());
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback(
    (pagePath: string): void => {
      history.pushState(null, "", pagePath);
      setLocation(readLocation());
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer !== null) {
        scrollContainer.scrollTop = 0;
      }
    },
    [scrollContainerRef]
  );
  return { location, navigate };
}

function readLocation(): PageLocation {
  return { hash: window.location.hash, pathname: window.location.pathname };
}
