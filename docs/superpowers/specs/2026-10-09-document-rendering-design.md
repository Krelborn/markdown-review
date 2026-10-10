# Document rendering: design spec

- **Date:** 2026-10-09
- **Status:** Approved in spec review (2026-10-09)
- **Changes:** sections 7 (Anchoring) and 10 (Browser UI) of the [design spec](2026-10-08-markdown-review-design.md), and the code block styling from the [side panel spec](2026-10-09-side-panel-redesign-design.md#10-doc-column-and-top-bar)
- **Upstream:** the table polish in section 15 is a StylesUI change, made in that repository

## 1. Problem

A doc with frontmatter, code in several languages, a table, a blockquote, a Mermaid diagram and three comments was reviewed in the browser, in light and dark mode. These problems showed:

1. **Code blocks run into the prose.**
   - Every fence sits in a `<div data-md-block>` wrapper. Its `<pre>` is that wrapper's first child, so Prose's `:first-child` rule removes its top margin and the wrapper has none of its own. Code touches the paragraph above it, and two code blocks in a row merge into one. HTML blocks and Mermaid diagrams have the same gap missing.
   - Only Shiki's output has a border, so plain fences and indented code have none.
   - In dark mode, highlighted code uses github-dark's background and plain code uses the surface colour.
   - Nothing says which language a block is in.
2. **Syntax highlighting seems missing.** It works, but only for fences that name a language. Of roughly 590 fences in this repo's own docs, about 360 name none.
3. **Comment highlights are faint.** The `warning-subtle` and `primary-subtle` tints are close to the page colour in light mode, and muddy in dark mode. In light mode the selected thread looks almost the same as the others.
4. **The + doesn't show its target.** Nothing marks which block a whole-block comment will go on.
5. **Frontmatter renders as prose.** markdown-it reads the `---` fences as horizontal rules and the YAML as a run-on paragraph and a list.
6. **Smaller gaps.**
   - Nothing links a highlight to its card when the pointer is over one of them.
   - Text under two threads looks the same as text under one.
   - GitHub alerts (`> [!NOTE]`) render as blockquotes with the marker as literal text.
   - Task-list checkboxes look disabled.
   - There is no way to link to a section.
   - Mermaid diagrams keep the colours of the mode they were drawn in.
   - Tables have no header background, and a wide table overflows the column.

## 2. Intent and success criteria

**Intent:** the doc reads like a well-typeset document, and the review layer on top of it (highlights, markers, the + target) is unmistakable without getting in the way of reading.

**Success looks like:**

1. Every code block has the prose gap above and below it, and the same frame in light and dark mode. A fence that names a language shows the language.
2. In both modes, and in Chromium and WebKit, unselected, selected and pending highlights are easy to tell apart from each other and from plain text.
3. While the + has the pointer or keyboard focus, its block is framed. While a whole-block comment is being written, the frame stays on its block.
4. A doc with YAML frontmatter shows a Properties panel in place of the raw YAML. The panel takes whole-block comments, which quote the YAML.
5. Comments made before this change, on docs with frontmatter or alerts, still sit on their text afterwards.
6. Hovering a highlight emphasises its card and marker. Hovering or focusing a card emphasises its highlight.
7. Text under two threads looks different from text under one.
8. GitHub alerts render as titled callouts.
9. Hovering a heading shows a link that puts the section's address in the page address and on the clipboard.
10. Task-list checkboxes read as ticked or not ticked, not as disabled controls.
11. Mermaid diagrams have the prose gap, and follow a switch between light and dark mode.
12. The conformance test passes, with new cases for frontmatter, alerts and heading links.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Code block gap | A flow margin on block wrapper `div`s | Put the block attributes on the `<pre>` | Mermaid replaces the `<pre>`, and HTML blocks need a wrapper anyway |
| Code block frame | One background, border and radius for all code; Shiki colours only the tokens | Keep each theme's background | Highlighted and plain code look like the same kind of thing |
| Language label | A header drawn by CSS from a `data-language` attribute | A label element in the DOM | Generated content is not DOM text, so the canonical-text walk and selections never see it |
| Unlabelled fences | Plain, no header | Detect the language | Detection guesses wrong often enough to mislead, and needs another library |
| Highlights | Tint plus underline; dashed underline while pending | Stronger tint only; underline, filled when selected | Chosen by the user. The underline marks the exact extent and works on any background |
| + target | A ring drawn over the block | A bar in the gutter | Chosen by the user. Drawn outside the rendered HTML, so the doc is not changed |
| Frontmatter display | A Properties panel, collapsible, as one whole-block block | A one-line strip of key/value pairs; one block per property | Chosen by the user. Per-property comments would need YAML parsing on the server |
| Frontmatter parsing | A block rule of our own in `createMarkdownIt` | `markdown-it-front-matter` 0.2.4 | About 30 lines, and we decide its token's lines and content. The package was last published in 2024 |
| YAML | `yaml` 2.9.1, in the browser only, loaded when a doc has frontmatter | `js-yaml`; a hand-written parser | Maintained, no dependencies, and it reports errors without throwing |
| Re-anchoring after a canonical-text change | Fold an anchoring version into the source hash | Bump `storeFileVersion`; bump `protocolVersion` | One constant. Every stored doc re-anchors once, on its next read, and no file or API shape changes |
| GitHub alerts | `@mdit/plugin-alert` 2.0.2, with our own title renderer | `markdown-it-github-alerts` 1.0.1 | Same family as the task-list plugin, on the same `@mdit/helper` 1.1.2 |
| Table polish | In StylesUI's Prose | An override in this app | Prose owns table styling, and other Prose users get it too |

## 4. Code blocks

- **Gap.** Every `div[data-md-block]` that is not the first child of its parent gets `margin-block-start: var(--sui-prose-flow)`. This covers fences, indented code, HTML blocks, frontmatter and Mermaid, at the top level and inside lists and blockquotes.
- **Frame.** A `<pre>` inside a block wrapper gets the `--sui-color-surface` background, a `--sui-border-width` solid `--sui-color-border` border, `--sui-radius-lg` corners and no margin. This applies to Shiki's output and to plain code alike.
- **Shiki in dark mode.** `global.css` switches only the token colours to Shiki's dark ones. It no longer sets a background on `.shiki` or its spans; the frame owns the background in both modes.
- **Language header.**
  - The fence rule in `createMarkdownIt` adds `data-language` to the wrapper, holding the fence's language as written, when the fence names one other than `mermaid`.
  - CSS draws a header strip from that attribute with `::before`: monospace at `0.75rem`, `--sui-color-text-muted` text, a background of `--sui-color-surface` mixed with 5% of `--sui-color-text`, the frame's border, and rounded top corners. The `<pre>` below it loses its top border and top corners.
  - Only a wrapper that still holds a `<pre>` shows the header.
  - A fence that names no language shows no header.
- **Highlighting** is unchanged: Shiki with github-light and github-dark, for the languages it knows. A fence in a language Shiki doesn't know is plain, with a header.
- The styles live in `DocumentView.module.css`, scoped under `.content`.

## 5. Comment highlights

All underlines are 2px with a 3px offset, written as the longhand `text-decoration-line`, `-style`, `-thickness` and `-color`. In testing, WebKit drew the longhands with the `warning-text` colour, but did not draw the shorthand with the lighter `warning` colour.

| Highlight | Background | Underline |
| --- | --- | --- |
| `markdown-review-threads` | `--sui-color-warning` at 30% | solid, `--sui-color-warning-text` |
| `markdown-review-overlap` (new, section 10) | `--sui-color-warning` at 30%, painted over the threads highlight | none |
| `markdown-review-hovered` (new, section 9) | `--sui-color-warning` at 55% | solid, `--sui-color-warning-text` |
| `markdown-review-selected` | `--sui-color-primary` at 25% over `--sui-color-background` | solid, `--sui-color-primary` |
| `markdown-review-pending` | `--sui-color-primary` at 25% over `--sui-color-background` | dashed, `--sui-color-primary` |

- "At 30%" means `color-mix(in srgb, <colour> 30%, transparent)`. "At 25% over `--sui-color-background`" means `color-mix(in srgb, <colour> 25%, var(--sui-color-background))`, which is opaque, so the selected and pending passages cover the highlights beneath them.
- The rules keep the descendant form, `.content ::highlight(<name>)`, so they reach every element in the doc.
- The highlights paint in the table's order, from threads at the bottom to pending on top. `useThreadHighlights` registers them in that order and sets each `Highlight`'s `priority` to match. The plan checks that WebKit honours `priority`; if it does not, registration order alone gives the same result.

## 6. The + target

- **Measuring.** `HoveredBlock` gains the block's box relative to the view: `top`, `left`, `width` and `height`.
- **Showing.** `DocumentControls` notes when the + has the pointer (`pointerenter` and `pointerleave`) or focus (`focus` and `blur`). While it does, it renders a block target:
  - An absolutely positioned element over the block's box, grown by 4px left and right and 6px above and below, so it clears the + and the markers.
  - A 2px `--sui-color-primary` border, a background of `--sui-color-primary` at 7%, and `--sui-radius-lg` corners.
  - `pointer-events: none`, `aria-hidden`, `data-md-ignore`.
  - It fades in over 120ms, unless the user prefers reduced motion.
- **While writing.** The open editor's new comment can be a passage that covers exactly one block's whole text, as `blockPassage` builds it. While it is, the target stays on that block. It is measured like the markers, again whenever the content resizes, and goes when the editor closes or saves.
- The target sits above the doc's text and below the + and the markers. Its fill is light enough to read through.

## 7. Frontmatter

### Recognition (shared)

- A block rule in `createMarkdownIt`, run before every other block rule, recognises frontmatter when the doc's first line is `---`, allowing trailing whitespace, and its second line is not blank, so a doc that opens with a horizontal rule renders as before. The frontmatter runs to the next line that is `---` or `...`. With no closing line, the doc renders as it does today.
- The rule emits one `front_matter` token. Its `map` runs from the first line through the closing line, and its `content` is the lines between the fences.
- `findLeafBlocks` maps `front_matter` to a new leaf block kind, `frontMatter`. In `parseBlocks`:
  - its `text` is the content without its final newline
  - its `lineOffsets` start on line 2, the way a fence's start on the line after its opening fence
  - it is `wholeBlockOnly`
- Empty frontmatter has no text, so it takes its source as text under the existing rule for blocks with no visible text.
- The shared render rule outputs the YAML as plain code inside the block wrapper, with a `data-front-matter` attribute: `<div data-md-block … data-front-matter><pre><code>…</code></pre></div>`. This is the fallback the browser starts from.

### The Properties panel (browser)

`renderDocument` calls a new `renderFrontMatter` on the template, before the HTML is inserted into the page:

- When the doc has frontmatter, it loads `yaml` with a dynamic import and parses the content with `parseDocument`.
- **Fallback.** If the YAML has errors, or its top level is not a mapping, the code block stays, and its wrapper gets `data-language="frontmatter"` so the header names it.
- **Panel.** Otherwise the `<pre>` is replaced by a `<details open>` panel:
  - a `<summary>` reading "Properties"
  - a `<dl>` with a `<dt>` (a type icon and the key) and a `<dd>` (the value) for each key, in source order
- Every node is built with DOM calls and `textContent`; no HTML from the YAML is ever parsed.

| Value | Shown as | Type icon |
| --- | --- | --- |
| String | The text as written | text |
| String that is an `http` or `https` URL | A link | link |
| String in ISO date form (`2026-10-01`, with an optional time) | The text as written | date |
| Number | The text as written | number |
| Boolean | A ticked or unticked checkbox, styled as in section 13 | checkbox |
| Null or empty | "Empty", muted | text |
| List of scalars | A chip for each item; under the `tags` key, tag chips in the primary colour | list, or tag for `tags` |
| Mapping, or a list holding mappings or lists | The value as YAML, in monospace | nested |

- **Icons** are CSS `mask-image` data URIs chosen by a `data-type` attribute on the `<dt>`, so there is no SVG in the DOM. The Content Security Policy already allows `data:` images.
- **Styles** follow the prototype: a bordered surface panel with `--sui-radius-lg` corners, an uppercase muted summary with a chevron, and a two-column grid of muted keys and text-coloured values.
- **Empty frontmatter** shows the panel with "No properties".

### Comments on frontmatter

The panel is one whole-block block, like a Mermaid diagram.

- The + and its target work on it.
- A selection inside it snaps to the whole block, as for any whole-block block.
- The agent sees the YAML's lines and the YAML as the quote.

## 8. Re-anchoring after this change

Frontmatter (section 7) and alerts (section 11) change the canonical text of docs that use them. Re-anchoring runs only when a doc's source hash changes, so threads stored against an unchanged doc would keep offsets into the old canonical text.

- A new constant, `anchoringVersion` in `src/shared/markdown/`, names the version of the canonical-text rules. It starts at 2, and goes up by one whenever a change makes the same source give different canonical text.
- `hashSource` hashes the version, a newline, then the source. Every stored threads file's `sourceHash` then differs once, so the next read of each doc re-anchors its threads and writes the new hash. Text that has not moved matches exactly, in place.
- The browser only ever compares hashes the server gave it, so it needs no change.
- `protocolVersion` stays as it is: no HTTP or file shape changes. An older server re-anchors with its own rules, and still agrees with the web app it serves.
- A thread stored under the old rules on a short GitHub alert can come back Outdated after the upgrade, because the removed marker line is more than the fuzzy match tolerates for a short passage. Its quote is kept.

## 9. Linking highlights and cards on hover

- **State.** `HoveredThreadProvider` keeps the thread under the pointer, set by the doc, its markers and the cards, apart from the thread whose card has the keyboard focus. The hovered thread is the one under the pointer, else the focused one, so a focused card's thread stays hovered after the pointer passes over another thread.
- **In the doc.**
  - On `pointermove` over the content, at most once per animation frame, the view maps the point to an offset with `offsetAtPoint` and then to a thread with `threadAtOffset`, over the highlighted threads.
  - Hovering a marker hovers its thread.
  - While the pointer is over a highlight, the content shows a pointer cursor, since a click selects the thread.
- **In the panel.** A thread card puts its thread under the pointer on `pointerenter` and clears it on `pointerleave`. It makes its thread the focused one on `focusin`, and clears that on `focusout` when the focus leaves the card.
- **Removal.** A hover ends when what set it goes away without a `pointerleave` or `focusout`: a thread under the pointer that is no longer highlighted, a marker removed from under the pointer, or a card removed while it has the pointer or the focus.
- **Effects.**
  - An unselected hovered thread's passage moves into the `markdown-review-hovered` highlight.
  - Its marker gets a 2px `--sui-color-primary` outline.
  - Its card takes `--sui-color-secondary-subtle` as its background.
- Hovering never scrolls either column.

## 10. Overlapping threads

- `useThreadHighlights` computes where the ranges of the unselected highlighted threads intersect, pair by pair, and registers those intersections as `markdown-review-overlap`. That highlight adds a second warning tint over the first, so text under two threads is deeper.
- Text under three or more threads looks the same as text under two.

## 11. GitHub alerts

- `createMarkdownIt` uses `@mdit/plugin-alert` with its five default names (note, tip, important, warning, caution), at the top level only, as GitHub does.
- **Title.** Our own title renderer outputs `<p class="markdown-alert-title" data-md-ignore>Note</p>`, with the name in title case from a fixed table. The plugin's own renderer prints the marker as written, such as "NOTE".
- **Blocks.** The title is not a block. The paragraphs inside the alert are blocks, as in a blockquote, and the marker line is no longer part of the canonical text (section 8).
- A `> [!NOTE]` line with nothing after it stays a blockquote, as the plugin requires content.
- **Styles.**
  - Each alert is a callout with a 3px start border and a tinted background.
  - Its title is in the matching text colour, after an icon drawn as a CSS mask.
  - The colours map as note → `info`, tip → `success`, important → `primary`, warning → `warning`, caution → `danger`, using each colour's `-subtle` and `-text` tokens.
- **Dependency.** The plugin is added to `dependencies`, since the server's `parseBlocks` uses it at run time, like the task-list plugin.

## 12. Heading links

- **Markup.** `addHeadingLinks` gives each heading that has an id a link, after `addHeadingIds` runs so the ids don't include it: `<a href="#<id>" aria-label="Link to <heading text>" data-heading-link data-md-ignore>#</a>`, appended at the end of the heading. It also sets the heading's own `aria-label` to its text, so the link does not join the heading's accessible name.
- **Visibility.** The link shows when the pointer is over the heading or the link has visible focus. It uses `--sui-color-text-muted` and `user-select: none`.
- **Clicking.**
  - The existing handling of `#` links scrolls to the heading and puts it in the page address.
  - The click also copies the page's address to the clipboard; `127.0.0.1` and `localhost` are secure contexts.
  - The link shows a tick for 1.5 seconds, from a `data-copied` attribute.
  - If the copy fails, the address still changes.
- **Canonical text.** The walk skips `data-md-ignore`, so the conformance test, whose corpus has headings, still passes.

## 13. Task-list checkboxes

The checkboxes stay `disabled`, since they show state and can't be changed. They are styled rather than left to the browser:

- `appearance: none`, a 1em square, a `--sui-color-input-border` border and `--sui-radius-sm` corners.
- When ticked, a `--sui-color-primary` fill and a tick in `--sui-color-on-primary`, drawn as a CSS mask.
- Full opacity and the default cursor.

## 14. Mermaid

- **Gap.** Diagrams get the gap from section 4, and are centred.
- **Light and dark.** `renderMermaidDiagrams` keeps each diagram's definition on its block wrapper. `useMermaidDiagrams` redraws every diagram when `prefers-color-scheme` changes.
- The block wrapper and its attributes stay as they are, so anchoring is unchanged.

## 15. Upstream: tables in StylesUI Prose

This part is done in the StylesUI repository, separately from this spec's plan:

- **Header cells** get the `--sui-color-surface` background.
- **Wide tables** scroll sideways inside their own box instead of overflowing, as GitHub's styles do: `display: block`, `width: max-content`, `max-width: 100%`, `overflow: auto`.

markdown-review picks this up by upgrading `@krelborn/stylesui`. After that upgrade the conformance test must still pass, since table rows are blocks.

## 16. Components and files

| File | Change |
| --- | --- |
| `src/shared/markdown/createMarkdownIt.ts` | The frontmatter block rule and its fallback render rule; `data-language` on fence wrappers; the alert plugin and its title renderer |
| `src/shared/markdown/findLeafBlocks.ts`, `LeafBlock.ts`, `parseBlocks.ts` | The `frontMatter` leaf block kind |
| `src/shared/markdown/anchoringVersion.ts` (new) | The constant from section 8 |
| `src/server/store/hashSource.ts` | Hashes the anchoring version with the source |
| `src/web/rendering/renderDocument.ts` | Calls `renderFrontMatter`, then adds heading links after `addHeadingIds` |
| `src/web/rendering/renderFrontMatter.ts` (new) | The Properties panel and its fallback |
| `src/web/rendering/addHeadingLinks.ts` (new) | The heading links |
| `src/web/rendering/renderMermaidDiagrams.ts`, `components/DocumentView/useMermaidDiagrams.ts` | Keep definitions and redraw on a colour-scheme change |
| `src/web/components/DocumentView/DocumentView.module.css` | The code frame, language header, gap, highlights, block target, Properties panel, alerts, heading links and checkboxes |
| `src/web/global.css` | Shiki's dark mode switches token colours only |
| `src/web/components/DocumentView/useHoveredBlock.ts` | The block's box |
| `src/web/components/DocumentView/DocumentControls.tsx` | Tracks the + and renders the block target; marker hover |
| `src/web/components/DocumentView/useThreadHighlights.ts` | Overlap and hovered highlights, and their order |
| `src/web/components/DocumentView/useHoveredThread.ts` (new) | Maps the pointer to a highlighted thread |
| `src/web/components/DocumentView/DocumentView.tsx`, `App/App.tsx`, `App/DocumentPane.tsx` | Pass `hoveredThreadId` and its setter, and the pending block target |
| `src/web/components/ThreadSidebar/*`, `ThreadCard/ThreadCard.tsx`, `ThreadCard.module.css` | Card hover and focus set the hovered thread; the hovered card style |
| `src/web/components/DocumentView/useDocumentClicks.ts` | Copies the address when a heading link is clicked |
| `src/web/rendering/testing/conformanceCorpus.md` | The new cases from section 17 |
| `package.json` | `@mdit/plugin-alert` in `dependencies`; `yaml` in `devDependencies`, since the build bundles it into the web app |

## 17. Testing

### Unit and component tests (`node` and `web` projects)

- **`parseBlocks`.**
  - Frontmatter gives one `wholeBlockOnly` block with the YAML as text and lines starting on line 2.
  - `---` that is not on line 1, or has no closing line, is not frontmatter.
  - Empty frontmatter takes its source as text.
  - An alert's paragraphs are blocks, and the marker is not in their text.
- **Conformance corpus.** It gains frontmatter at the top, one alert of each kind, and a heading link is now on every heading. Every block still has exactly one element with its index and lines, and every block that is not whole-block-only reads back its canonical text.
- **`renderDocument`.**
  - Fence wrappers have `data-language`, except Mermaid's and unlabelled ones.
  - Headings keep their ids and gain a `data-md-ignore` link.
  - Alert titles are in title case and carry `data-md-ignore`.
- **`renderFrontMatter`.**
  - A mapping becomes a panel with one row per key, in order.
  - Each value type renders as in the table in section 7.
  - YAML containing markup shows it as text.
  - Invalid YAML, or YAML whose top level is not a mapping, keeps the code block with the frontmatter header.
- **`hashSource`.** The hash changes when the anchoring version changes.
- **`ReviewStore`.** A threads file whose hash was made without the anchoring version re-anchors on its next read, and moves a thread on a doc with frontmatter to its text.
- **`useThreadHighlights`.** Through the `CSS.highlights` stand-in:
  - overlapping thread ranges produce an overlap highlight
  - the hovered thread moves from the threads highlight to the hovered one
- **`DocumentView`.**
  - The block target appears while the + has the pointer or focus, and goes when it has neither.
  - While a whole-block comment is open, the target stays on its block.
- **`ThreadSidebar`.** Hovering or focusing a card reports its thread as hovered, and the hovered card has its style.

### End-to-end tests (Playwright, Chromium and WebKit)

- **Frontmatter.**
  1. Open a doc with frontmatter.
  2. The Properties panel shows its keys.
  3. Pressing + beside it and saving a comment gives a draft that quotes the YAML.
- **Hover link.** Hovering a highlight gives its card the hovered style, and hovering a card adds the thread to the hovered highlight (checked through `CSS.highlights`).
- **Block target.** Hovering the + shows the target over the block.
- **Heading link.** Clicking a heading's link puts its fragment in the address.

## 18. Docs to update

- **Design spec.**
  - [Section 3](2026-10-08-markdown-review-design.md#3-scope): frontmatter rendering leaves the non-goals.
  - [Section 7](2026-10-08-markdown-review-design.md#7-anchoring):
    - frontmatter as a whole-block block, and alert markers left out of the canonical text
    - the anchoring version in the source hash, under "When re-anchoring runs"
  - [Section 10](2026-10-08-markdown-review-design.md#10-browser-ui):
    - the highlight styles, the hover link and the block target
    - the rendering list: frontmatter, alerts, language headers and heading links
- **Side panel spec,** section 10: point to this spec for code blocks.
- **README,** "Docs render with GitHub-style tables, …": add frontmatter as Properties, GitHub alerts and heading links.

## 19. Delivery

The plan can deliver this in slices, each shippable alone:

1. CSS only: the code gap, frame and Shiki fix, highlights, checkboxes, and the Mermaid gap and centring.
2. Language headers (`data-language`).
3. The block target.
4. Hover link and overlap.
5. Heading links, and Mermaid colour-scheme redraw.
6. The anchoring version, then alerts and frontmatter, which both change the canonical text.

## 20. Out of scope

- A comment on a single frontmatter property, and editing properties.
- TOML (`+++`) and JSON frontmatter.
- Guessing the language of unlabelled fences.
- A copy button on code blocks.
- Alerts nested in lists or blockquotes, and alert names beyond GitHub's five.
- Telling three overlapping threads from two.
- Any change to the protocol, the HTTP API or the CLI.
