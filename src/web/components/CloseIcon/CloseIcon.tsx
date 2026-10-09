import type { JSX } from "react";

/**
 * A cross for buttons that close or hide something, drawn in the text colour. `IconButton` sizes it and hides it from
 * assistive technology.
 */
export function CloseIcon(): JSX.Element {
  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
