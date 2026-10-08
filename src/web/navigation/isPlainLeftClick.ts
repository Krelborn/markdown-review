/**
 * Tells whether a click on a link should follow it in the page, rather than in a new tab or window as a middle click
 * or a click with a modifier key asks the browser to
 */
export function isPlainLeftClick(
  event: Pick<MouseEvent, "altKey" | "button" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
