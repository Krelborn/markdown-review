import { createDocumentText } from "../../shared/markdown/createDocumentText";
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { PagePoint } from "../anchoring/PagePoint";
import { renderDocument } from "../rendering/renderDocument";

export interface MountedDocument {
  container: HTMLElement;
  documentText: DocumentText;

  /**
   * The point just before the first occurrence of `text` in the page, or after it when `after` is set
   */
  pointAt: (text: string, after?: boolean) => PagePoint;
}

/**
 * Renders `docs/plan.md` with the given source into the page, the way the review page does
 */
export async function mountDocument(source: string): Promise<MountedDocument> {
  const container = document.createElement("article");
  container.innerHTML = await renderDocument(source, "docs/plan.md");
  document.body.replaceChildren(container);
  const pointAt = (text: string, after = false): PagePoint => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(text) ?? -1;
      if (index !== -1) {
        return { node, offset: after ? index + text.length : index };
      }
    }
    throw new Error(`The page has no text "${text}"`);
  };
  return { container, documentText: createDocumentText(source), pointAt };
}
