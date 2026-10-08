import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "./standInForLayout";
import "./standInForPopovers";

// Testing Library only cleans up automatically when Vitest globals are on
afterEach(() => {
  cleanup();
});
