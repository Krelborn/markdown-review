import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { BundledLanguage } from "shiki/langs";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

import type { Highlight } from "../../shared/markdown/createMarkdownIt";

let highlighter: Promise<HighlighterCore> | undefined;

/**
 * Prepares syntax highlighting for the languages of a doc's fenced code
 *
 * @param languages the languages the doc's fences name, in any case
 * @returns a highlight function for `createMarkdownIt` that colours code in the light and dark themes; code in a
 *   language Shiki does not know, and Mermaid diagrams, stay plain
 */
export async function loadHighlight(languages: readonly string[]): Promise<Highlight> {
  highlighter ??= createHighlighterCore({
    // The app's Content Security Policy does not allow the WebAssembly that Shiki's default engine compiles
    engine: createJavaScriptRegexEngine({ forgiving: true }),
    themes: [bundledThemes["github-light"], bundledThemes["github-dark"]],
  });
  const loaded = await highlighter;
  const known = languages.map((language) => language.toLowerCase()).filter(isHighlightable);
  await loaded.loadLanguage(...known.map((language) => bundledLanguages[language]));
  return (code, language) =>
    isHighlightable(language.toLowerCase())
      ? loaded.codeToHtml(code, {
          lang: language.toLowerCase(),
          themes: { dark: "github-dark", light: "github-light" },
        })
      : null;
}

function isHighlightable(language: string): language is BundledLanguage {
  return language !== "mermaid" && Object.hasOwn(bundledLanguages, language);
}
