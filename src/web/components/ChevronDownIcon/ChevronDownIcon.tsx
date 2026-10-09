import type { JSX } from "react";

/**
 * A downward chevron for buttons that open a menu, drawn in the text colour and hidden from assistive technology
 */
export function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      fill="none"
      height="0.75em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      width="0.75em"
      aria-hidden={true}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
