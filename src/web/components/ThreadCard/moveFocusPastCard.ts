/**
 * Moves focus off a thread's card before it goes: to the location of the next card in view, or of the card before
 * when it is the last, or to the first button in the comments, which starts a comment, when no other card is in view
 *
 * @param card the card that is going, or null when it is not on the page
 */
export function moveFocusPastCard(card: HTMLElement | null): void {
  const comments = card?.closest("aside");
  if (card === null || comments === null || comments === undefined) {
    return;
  }
  const locations = [...comments.querySelectorAll<HTMLElement>("[data-thread-location]")].filter(
    (location) => location.closest("details:not([open])") === null
  );
  const index = locations.findIndex((location) => card.contains(location));
  const target = locations[index + 1] ?? locations[index - 1] ?? comments.querySelector("button");
  target?.focus();
}
