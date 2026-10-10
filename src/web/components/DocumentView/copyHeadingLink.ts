const copiedDuration = 1500;

/**
 * Copies the page's address, which a heading link has just set to the heading, and marks the link as copied for a
 * moment
 *
 * @param link the heading link the user clicked
 */
export function copyHeadingLink(link: Element): void {
  navigator.clipboard.writeText(location.href).then(
    () => {
      link.setAttribute("data-copied", "");
      setTimeout(() => link.removeAttribute("data-copied"), copiedDuration);
    },
    // A refused copy still leaves the heading in the page's address, where the user can copy it
    () => {}
  );
}
