import { createContext } from "react";

import type { Appearance } from "../../shared/appearance/Appearance";

export interface AppearanceSettings {
  /**
   * The colour mode and palette the page is drawn in
   */
  appearance: Appearance;

  /**
   * Applies and stores the given settings, keeping the others as they are
   */
  changeAppearance: (settings: Partial<Appearance>) => void;
}

export const AppearanceContext = createContext<AppearanceSettings | null>(null);
