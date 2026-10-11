import type { Appearance } from "./Appearance";
import { colorModeSchema, paletteNameSchema } from "./Appearance";

const cookieNames = { mode: "markdown-review-mode", palette: "markdown-review-palette" } as const;

/**
 * The longest browsers keep a cookie
 */
const maxAgeSeconds = 400 * 24 * 60 * 60;

/**
 * Reads the appearance settings the user has chosen from their cookies
 *
 * @param cookies a `Cookie` request header, or `document.cookie`
 * @returns each setting whose cookie holds a value on its list; a setting with no cookie, or an unknown value, is left
 *   out
 */
export function readStoredAppearance(cookies: string): Partial<Appearance> {
  const values = new Map(
    cookies.split(";").flatMap((cookie): [string, string][] => {
      const separator = cookie.indexOf("=");
      return separator === -1 ? [] : [[cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim()]];
    })
  );
  const stored: Partial<Appearance> = {};
  const mode = colorModeSchema.safeParse(values.get(cookieNames.mode));
  if (mode.success) {
    stored.mode = mode.data;
  }
  const palette = paletteNameSchema.safeParse(values.get(cookieNames.palette));
  if (palette.success) {
    stored.palette = palette.data;
  }
  return stored;
}

/**
 * Formats a cookie for each of the given appearance settings, which every review server on the same host can read
 *
 * @param settings the settings to store
 * @returns one `document.cookie` assignment per setting
 */
export function formatAppearanceCookies(settings: Partial<Appearance>): string[] {
  const cookies: string[] = [];
  if (settings.mode !== undefined) {
    cookies.push(formatCookie(cookieNames.mode, settings.mode));
  }
  if (settings.palette !== undefined) {
    cookies.push(formatCookie(cookieNames.palette, settings.palette));
  }
  return cookies;
}

function formatCookie(name: string, value: string): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict`;
}
