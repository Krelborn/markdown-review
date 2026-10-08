/**
 * Gives a rendered doc's headings the ids GitHub gives them, so `#heading` links work as they do on GitHub
 *
 * @param container the rendered doc
 */
export function addHeadingIds(container: ParentNode): void {
  const used = new Map<string, number>();
  for (const heading of container.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const slug = slugify(heading.textContent);
    const count = used.get(slug) ?? 0;
    used.set(slug, count + 1);
    heading.id = count === 0 ? slug : `${slug}-${count}`;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}
