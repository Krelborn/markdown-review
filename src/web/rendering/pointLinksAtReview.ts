const repositoryBase = "https://repository.invalid/";

/**
 * Points a rendered doc's relative links and images at the review app: a link to another markdown doc opens it for
 * review, other repo files are served from the repo, and links that leave the review open in a new tab
 *
 * @param container the rendered doc
 * @param documentPath the doc's repo-relative path, which relative URLs resolve against; a path starting with "/"
 *   starts at the repo root, as on GitHub
 */
export function pointLinksAtReview(container: ParentNode, documentPath: string): void {
  for (const link of container.querySelectorAll("a[href]")) {
    pointLinkAtReview(link, documentPath);
  }
  for (const image of container.querySelectorAll("img[src]")) {
    const repositoryUrl = toRepositoryUrl(image.getAttribute("src") ?? "", documentPath);
    if (repositoryUrl !== null) {
      image.setAttribute("src", `/files${repositoryUrl.pathname}`);
    }
  }
}

function pointLinkAtReview(link: Element, documentPath: string): void {
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("#")) {
    return;
  }
  const repositoryUrl = toRepositoryUrl(href, documentPath);
  if (repositoryUrl?.pathname.toLowerCase().endsWith(".md")) {
    link.setAttribute("href", `/document${repositoryUrl.pathname}${repositoryUrl.hash}`);
    return;
  }
  if (repositoryUrl !== null) {
    link.setAttribute("href", `/files${repositoryUrl.pathname}${repositoryUrl.hash}`);
  }
  link.setAttribute("rel", "noopener noreferrer");
  link.setAttribute("target", "_blank");
}

/**
 * @returns the URL inside the repo that a relative URL names, or null for a URL with a scheme or host of its own
 */
function toRepositoryUrl(href: string, documentPath: string): URL | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    return null;
  }
  return new URL(href, new URL(documentPath.split("/").map(encodeURIComponent).join("/"), repositoryBase));
}
