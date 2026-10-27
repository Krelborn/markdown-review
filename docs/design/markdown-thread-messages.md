# Render thread messages as markdown

## Problem

Agents write `reply` and `resolve` messages in markdown: inline code for identifiers, bullet lists of edits, the odd fenced snippet or link. `Message.tsx` renders `body` as plain text in a `Text` paragraph, and `.body` in `ThreadCard.module.css` sets `white-space: pre-wrap`. In the 18-24rem column the user reads raw backticks, asterisks and `- ` lines. In a second round of a long plan, every thread has such an answer, so scanning is slow. Nothing in `src/web` renders markdown outside the doc renderer (`rendering/renderDocument.ts`, which uses `createMarkdownIt` and `sanitizeRenderedHtml`).

## Options

1. **Restricted markdown-it instance plus DOMPurify, rendered with `dangerouslySetInnerHTML`.** Reuses the sanitiser and markdown-it already bundled. Cost: one HTML string per message, and a sanitiser config to maintain. Risk: an XSS hole if the allowlist is loose.
2. **Walk markdown-it tokens into React elements.** No HTML string, so no sanitiser. Cost: a token-to-element renderer to write and test; more code than option 1. Risk: bugs in the walker, and it drifts from markdown-it's own renderer.
3. **A markdown React library (react-markdown).** Safe by default. Cost: a new dependency, with `minimumReleaseAge` and fallow bookkeeping, for something the app already has the parts for.

## Design

Option 1.

**Parser.** New `src/web/messages/renderMessageMarkdown.ts` (web only; the server never needs it) exports `renderMessageMarkdown(body: string): string`. It builds its own `markdownIt` instance at module scope: `html: false`, `linkify: false`, `breaks: true` (agents write single newlines and plain text showed them; keeps what the user typed), and disables the rules `heading`, `lheading`, `image`, `table` and `hr`; blockquotes stay on. Headings and tables then fall through as paragraph text, so no content is lost. No `tasklist` or `alert` plugins: `- [ ] x` reads as a list item with literal brackets. It does not import `createMarkdownIt`, so canonical text, the conformance test and `anchoringVersion` are untouched.

**Sanitiser.** Add `sanitizeMessageHtml` beside `sanitizeRenderedHtml`, calling `DOMPurify.sanitize` with `ALLOWED_TAGS: p, br, em, strong, del, code, pre, ul, ol, li, blockquote, a` and `ALLOWED_ATTR: href, class`. An `afterSanitizeAttributes` hook (added and removed per call, or one scoped instance via `DOMPurify(window)`, to avoid changing the doc renderer's global behaviour) sets `target="_blank"` and `rel="noopener noreferrer"` on every `a`. Allowed URI schemes stay DOMPurify's default (http, https, mailto) plus relative.

**Links.** Absolute links open in a new tab. Relative links to repo files: leave inert (render the text without an `href`) in v1. A message-relative path has no base: it is relative to nothing, and agents usually write repo-root paths or bare `src/x.ts` in code spans. Resolving those against `/files/` could open a download or a 404. Revisit if users ask.

**Fenced code.** Plain `<pre><code>`, no Shiki: loading the highlighter per card is costly and colour in a 20rem column adds little. CSS: `pre { overflow-x: auto; white-space: pre; max-inline-size: 100% }`, so a long line scrolls inside the card instead of widening the column. Inline `code` uses `overflow-wrap: anywhere` so long paths break. Language labels are dropped.

**Who renders.** Agent and user messages both render, for consistency in the thread. The user's draft reply (`sentAt === null`) renders too, since it is shown in the same `Message`; the comment form stays plain text, so what they typed is visible there and in the stored string. If this proves confusing, render drafts as plain text via one conditional.

**Component.** `Message.tsx` replaces the `Text` paragraph with a `div` carrying `styles.body` and the sanitised HTML, wrapped in `useMemo` keyed on `body`. A message is a short string and cards re-render rarely; the memo is enough, with no cache. `ThreadCard.module.css` drops `white-space: pre-wrap` from `.body` and adds rules for `.body p, ul, ol, li, pre, code, blockquote, a`, using StylesUI tokens (`--sui-font-size-sm`, `--sui-space-*`, `--sui-color-text-muted`) so the text matches the old `Text size="sm"`. Paragraphs and lists get small block margins, with the first and last child margin zero.

**Copying.** Selection copies rendered text: bullets and backticks are lost, and list items copy as separate lines. Accepted. The stored body is unchanged and is what the agent receives.

**Not changed.** Server, CLI, store, protocol, `protocolVersion`, the comment form, the doc renderer.

## Risks

- XSS through a message. Mitigation: `html: false` plus a strict allowlist; the test suite includes a corpus of payloads (`<script>`, `<img onerror>`, `javascript:` and `data:` links, nested HTML in link text). Check early by running those in jsdom.
- DOMPurify hook leaking into the doc renderer's sanitising. Use a scoped instance and test both.
- Agents that wrote `#` lines or tables see them as paragraph text. Check by sampling real replies.
- Narrow-column overflow from long unbroken tokens. Check in the e2e at 18rem.

## Done when

- `pnpm vitest run --project web src/web/messages` passes: unit tests cover inline code, emphasis, ordered and bullet lists, links (new tab, `rel`, `javascript:` stripped, relative link inert), raw HTML escaped, headings, images and tables degraded to text, and the XSS corpus.
- `ThreadCard.test.tsx` has a case for a list-and-code reply, checking the `li` and `code` elements.
- An e2e test (`src/e2e/`) replies via the CLI with a list, inline code and a long fenced line, and asserts the card shows a list, that the `pre` scrolls and the card is no wider than its column.
- `pnpm vitest run --project web src/web/rendering/blockConformance.test.ts` passes untouched; `git diff` shows no change under `src/shared`, `src/server`, `src/cli`, or `anchoringVersion.ts`.
- `pnpm verify` and `pnpm test:e2e` pass; a screenshot of a second-round thread checked by eye in light and dark mode.
