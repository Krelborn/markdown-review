import type { Appearance } from "../../shared/appearance/Appearance";
import { formatAppearanceCookies } from "../../shared/appearance/appearanceCookies";

/**
 * Replaces the page's appearance cookies with the given settings, so a test starts from a known choice
 *
 * @param settings the settings the user has chosen; by default none
 */
export function setAppearanceCookies(settings: Partial<Appearance> = {}): void {
  for (const name of ["markdown-review-mode", "markdown-review-palette"]) {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
  for (const cookie of formatAppearanceCookies(settings)) {
    document.cookie = cookie;
  }
}
