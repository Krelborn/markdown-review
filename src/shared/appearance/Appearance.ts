import { z } from "zod";

export const colorModeSchema = z.enum(["system", "light", "dark"]);

/**
 * Whether the page follows the operating system between light and dark, or stays in one of them
 */
export type ColorMode = z.infer<typeof colorModeSchema>;

/**
 * The mode the page is drawn in, once `system` is resolved
 */
export type ColorScheme = Exclude<ColorMode, "system">;

export const paletteNameSchema = z.enum(["paper", "bright", "mist", "dusk"]);

/**
 * The StylesUI palettes the user can choose from
 */
export type PaletteName = z.infer<typeof paletteNameSchema>;

/**
 * How the user has chosen to see the review page
 */
export interface Appearance {
  mode: ColorMode;
  palette: PaletteName;
}

export const defaultAppearance: Appearance = { mode: "system", palette: "paper" };
