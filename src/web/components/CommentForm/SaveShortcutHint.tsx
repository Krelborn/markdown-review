import { Kbd, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

/**
 * Tells the user they can save with Cmd+Enter on a Mac, or Ctrl+Enter elsewhere
 */
export function SaveShortcutHint(): JSX.Element {
  const modifier = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
  return (
    <Text size="xs" tone="muted">
      <Kbd>{modifier}</Kbd> <Kbd>↩</Kbd> to save
    </Text>
  );
}
