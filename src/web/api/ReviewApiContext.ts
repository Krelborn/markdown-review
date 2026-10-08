import { createContext } from "react";

import type { ReviewApi } from "./ReviewApi";

export const ReviewApiContext = createContext<ReviewApi | null>(null);
