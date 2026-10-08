import { useContext } from "react";

import type { ReviewApi } from "./ReviewApi";
import { ReviewApiContext } from "./ReviewApiContext";

/**
 * Gives a component the review server's API
 *
 * @returns the API
 * @throws when no ReviewApiContext surrounds the component
 */
export function useReviewApi(): ReviewApi {
  const api = useContext(ReviewApiContext);
  if (api === null) {
    throw new Error("useReviewApi needs a ReviewApiContext around the component");
  }
  return api;
}
