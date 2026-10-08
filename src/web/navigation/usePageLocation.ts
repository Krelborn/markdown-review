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
   * Shows another page of the app without reloading, as a new entry in the browser's history
   *
   * @param pagePath the page's path, with any fragment
   */
  navigate: (pagePath: string) => void;
}

/**
 * Follows the page's address, including the browser's back and forward buttons
 */
export function usePageLocation(): PageNavigation {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = (): void => setLocation(readLocation());
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((pagePath: string): void => {
    history.pushState(null, "", pagePath);
    setLocation(readLocation());
    scrollTo(0, 0);
  }, []);
  return { location, navigate };
}

function readLocation(): PageLocation {
  return { hash: window.location.hash, pathname: window.location.pathname };
}
