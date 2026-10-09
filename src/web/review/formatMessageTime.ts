/**
 * Formats when a message was sent, for the comments
 *
 * @param at when it was sent, as an ISO 8601 string
 * @param now the time it is now
 * @param locales the locales to format for; by default, the browser's
 * @returns the time of day, such as "10:42", for a message sent today, otherwise the day and month, such as "8 Oct"
 */
export function formatMessageTime(at: string, now: Date, locales?: Intl.LocalesArgument): string {
  const sent = new Date(at);
  if (sent.toDateString() === now.toDateString()) {
    return sent.toLocaleTimeString(locales, { hour: "2-digit", minute: "2-digit" });
  }
  return sent.toLocaleDateString(locales, { day: "numeric", month: "short" });
}
