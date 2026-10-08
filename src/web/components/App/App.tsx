import { Heading, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";

/**
 * The review page
 */
export function App(): JSX.Element {
  return (
    <Theme mode="system">
      <Heading level={1}>Markdown Review</Heading>
    </Theme>
  );
}
