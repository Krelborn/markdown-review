/**
 * Formats when a message was sent, for the comments
 *
 * @param at when it was sent, as an ISO 8601 string
 * @param now the time it is now
 * @param locales the locales to format for; by default, the browser's
 * @returns the time of day for a message sent today, such as "10:42", or "9:05 AM" on a 12-hour clock, otherwise the
 *   day and month, such as "8 Oct"
 */
export function formatMessageTime(at: string, now: Date, locales?: Intl.LocalesArgument): string {
  const sent = new Date(at);
  if (sent.toDateString() === now.toDateString()) {
    return sent.toLocaleTimeString(locales, { hour: hourFormatOf(locales), minute: "2-digit" });
  }
  return sent.toLocaleDateString(locales, { day: "numeric", month: "short" });
}

function hourFormatOf(locales: Intl.LocalesArgument): "2-digit" | "numeric" {
  const { hourCycle } = new Intl.DateTimeFormat(locales, { hour: "numeric" }).resolvedOptions();
  return hourCycle === "h11" || hourCycle === "h12" ? "numeric" : "2-digit";
}
