/**
 * Gives each of a rendered doc's headings a link to itself, at its end, and names the heading by its text alone so the
 * link does not join its name
 *
 * @param container the rendered doc, whose headings already have their ids
 */
export function addHeadingLinks(container: ParentNode): void {
  for (const heading of container.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")) {
    const text = heading.textContent;
    const link = heading.ownerDocument.createElement("a");
    link.textContent = "#";
    link.setAttribute("aria-label", `Link to ${text}`);
    link.setAttribute("data-heading-link", "");
    link.setAttribute("data-md-ignore", "");
    link.setAttribute("href", `#${heading.id}`);
    heading.setAttribute("aria-label", text);
    heading.append(link);
  }
}
