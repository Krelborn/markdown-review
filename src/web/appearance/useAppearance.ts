import { useContext } from "react";

import type { AppearanceSettings } from "./AppearanceContext";
import { AppearanceContext } from "./AppearanceContext";

/**
 * Gives a component the page's appearance and a way to change it
 *
 * @returns the appearance and `changeAppearance`
 * @throws when no AppearanceProvider surrounds the component
 */
export function useAppearance(): AppearanceSettings {
  const settings = useContext(AppearanceContext);
  if (settings === null) {
    throw new Error("useAppearance needs an AppearanceProvider around the component");
  }
  return settings;
}
