import { useSyncExternalStore } from "react";

import type { ColorScheme } from "../../shared/appearance/Appearance";

import { useAppearance } from "./useAppearance";

const darkModeQuery = "(prefers-color-scheme: dark)";

/**
 * Gives the colour scheme the page is drawn in
 *
 * @returns the mode the user chose, or under System the one the operating system asks for, updated when it switches
 */
export function useColorScheme(): ColorScheme {
  const { appearance } = useAppearance();
  const systemScheme = useSyncExternalStore(subscribeToSystemScheme, readSystemScheme);
  return appearance.mode === "system" ? systemScheme : appearance.mode;
}

function subscribeToSystemScheme(onChange: () => void): () => void {
  const darkMode = matchMedia(darkModeQuery);
  darkMode.addEventListener("change", onChange);
  return () => darkMode.removeEventListener("change", onChange);
}

function readSystemScheme(): ColorScheme {
  return matchMedia(darkModeQuery).matches ? "dark" : "light";
}
