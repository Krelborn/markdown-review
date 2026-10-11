import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";

import type { Appearance } from "../../shared/appearance/Appearance";
import { defaultAppearance } from "../../shared/appearance/Appearance";
import { formatAppearanceCookies, readStoredAppearance } from "../../shared/appearance/appearanceCookies";

import { AppearanceContext } from "./AppearanceContext";

export interface AppearanceProviderProps {
  children: ReactNode;
}

/**
 * Holds the page's appearance, which starts from the user's cookies, and keeps the page drawn in it; a choice is stored
 * in cookies that every review server on the host reads, and a tab picks up a choice made elsewhere when it is shown
 * again
 */
export function AppearanceProvider({ children }: AppearanceProviderProps): JSX.Element {
  const [appearance, setAppearance] = useState(readAppearance);

  useEffect(() => {
    // Storing the settings again restarts their cookies' lifetimes, so they last while the user keeps using the app
    storeAppearance(readStoredAppearance(document.cookie));
    const readAgain = (): void => {
      if (document.visibilityState === "visible") {
        const stored = readAppearance();
        setAppearance((current) =>
          current.mode === stored.mode && current.palette === stored.palette ? current : stored
        );
      }
    };
    document.addEventListener("visibilitychange", readAgain);
    return () => document.removeEventListener("visibilitychange", readAgain);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-sui-mode", appearance.mode);
    document.documentElement.setAttribute("data-sui-palette", appearance.palette);
  }, [appearance.mode, appearance.palette]);

  const changeAppearance = (settings: Partial<Appearance>): void => {
    storeAppearance(settings);
    setAppearance((current) => ({ ...current, ...settings }));
  };
  return <AppearanceContext value={{ appearance, changeAppearance }}>{children}</AppearanceContext>;
}

function readAppearance(): Appearance {
  return { ...defaultAppearance, ...readStoredAppearance(document.cookie) };
}

function storeAppearance(settings: Partial<Appearance>): void {
  for (const cookie of formatAppearanceCookies(settings)) {
    document.cookie = cookie;
  }
}
