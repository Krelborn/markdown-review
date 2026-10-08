import { createMarkdownIt } from "../../shared/markdown/createMarkdownIt";
import { fenceLanguage } from "../../shared/markdown/fenceLanguage";

const markdown = createMarkdownIt();

/**
 * Lists the languages a doc's fenced code blocks name
 *
 * @param source the doc's markdown
 * @returns each language once, as written in the first fence that names it
 */
export function findFenceLanguages(source: string): string[] {
  const languages = markdown
    .parse(source, {})
    .filter((token) => token.type === "fence")
    .map((token) => fenceLanguage(token.info))
    .filter((language) => language !== "");
  return [...new Set(languages)];
}
