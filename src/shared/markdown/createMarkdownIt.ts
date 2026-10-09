import { tasklist } from "@mdit/plugin-tasklist";
import markdownIt from "markdown-it";
import type { MarkdownIt, RendererRule, StateCore } from "markdown-it";

import { fenceLanguage } from "./fenceLanguage";
import { findLeafBlocks } from "./findLeafBlocks";
import { tokenAt } from "./tokenAt";
import { withoutFinalNewline } from "./withoutFinalNewline";

/**
 * Highlights the code of a fenced block
 *
 * @param code the code, without its final newline
 * @param language the fence's language, or an empty string
 * @returns the highlighted HTML, starting with `<pre`, or null to render the code unhighlighted
 */
export type Highlight = (code: string, language: string) => string | null;

export interface MarkdownRenderingOptions {
  highlight?: Highlight;
}

/**
 * Creates the markdown-it instance the server and the browser share, so both find the same blocks
 *
 * @param options how rendering highlights fenced code; parsing does not use it
 * @returns an instance whose rendered leaf block elements carry `data-md-block`, `data-md-start` and `data-md-end`
 */
export function createMarkdownIt({ highlight }: MarkdownRenderingOptions = {}): MarkdownIt {
  const markdown = new markdownIt({ html: true }).use(tasklist);
  const escapeHtml = markdown.utils.escapeHtml;

  const renderFence: RendererRule = (tokens, index, _options, _environment, renderer) => {
    const token = tokenAt(tokens, index);
    const code = withoutFinalNewline(token.content);
    const language = fenceLanguage(token.info);
    const languageClass = language === "" ? "" : ` class="language-${escapeHtml(language)}"`;
    const languageHeader = language === "" || language === "mermaid" ? "" : ` data-language="${escapeHtml(language)}"`;
    const highlighted = highlight?.(code, language) ?? `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`;
    return `<div${renderer.renderAttrs(token)}${languageHeader}>${highlighted}</div>\n`;
  };

  const renderCodeBlock: RendererRule = (tokens, index, _options, _environment, renderer) => {
    const token = tokenAt(tokens, index);
    return `<div${renderer.renderAttrs(token)}><pre><code>${escapeHtml(withoutFinalNewline(token.content))}</code></pre></div>\n`;
  };

  markdown.core.ruler.push("tag_leaf_blocks", tagLeafBlocks);
  markdown.renderer.rules.paragraph_open = renderParagraphOpen;
  markdown.renderer.rules.paragraph_close = renderParagraphClose;
  markdown.renderer.rules.fence = renderFence;
  markdown.renderer.rules.code_block = renderCodeBlock;
  markdown.renderer.rules.html_block = renderHtmlBlock;
  return markdown;
}

function tagLeafBlocks(state: StateCore): void {
  findLeafBlocks(state.tokens, state.src).forEach(({ endLine, startLine, token }, blockIndex) => {
    token.attrSet("data-md-block", blockIndex);
    token.attrSet("data-md-start", startLine);
    token.attrSet("data-md-end", endLine);
  });
}

// markdown-it renders nothing for the hidden paragraphs of tight lists, which would drop their block attributes
const renderParagraphOpen: RendererRule = (tokens, index, options, _environment, renderer) => {
  const token = tokenAt(tokens, index);
  return token.hidden ? `<span${renderer.renderAttrs(token)}>` : renderer.renderToken(tokens, index, options);
};

const renderParagraphClose: RendererRule = (tokens, index, options, _environment, renderer) =>
  tokenAt(tokens, index).hidden ? "</span>" : renderer.renderToken(tokens, index, options);

const renderHtmlBlock: RendererRule = (tokens, index, _options, _environment, renderer) => {
  const token = tokenAt(tokens, index);
  return `<div${renderer.renderAttrs(token)}>${token.content}</div>\n`;
};
