# About Popover Implementation Plan

**Goal:** An info button at the right end of the top bar opens a popover with the app's name, version, description, licence and copyright, and links to the repository, its issues and the third-party licences. The web build writes those licences to `dist/web/licences.md`, and the server serves them at `/licences`.

**Architecture:**
- `src/web/components/AboutPopover/appDetails.ts` reads the app's details from `package.json`, through named JSON imports, and its copyright line from `LICENSE`, imported with `?raw`.
- `AboutPopover` renders a StylesUI `IconButton` holding `InfoIcon`, and a `Popover` with `role="dialog"`. `TopBar` renders it last, and the title's `margin-inline-end: auto` pushes it to the right end.
- `vite.web.config.mts` sets `build.license: { fileName: "licences.md" }`. `shellRoutes.ts` adds `GET /licences`, which serves that file as plain text.

**Tech Stack:** React 19.3 with the React Compiler, `@krelborn/stylesui` 0.3.0, CSS modules, Hono, Vite 8, Vitest 5 with jsdom and Testing Library, Playwright 1.64 (Chromium and WebKit), oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-10-about-popover-design.md`. It changes the top bar in section 10 of `docs/superpowers/specs/2026-10-08-markdown-review-design.md`.

## Global Constraints

- **Coding standards.** The `coding-standards` plugin's standards are authoritative over this plan. Props are sorted alphabetically, then `aria-*`, then `data-*`. Boolean props are explicit. Identifiers use full words. JSDoc spans several lines. Tests are named `must … when …`, with Arrange-Act-Assert separated by blank lines and one `describe` per file.
- **Spelling.** British in prose, comments, UI text and our own identifiers (`licences`, `/licences`), as elsewhere in the repo. Names we don't own keep their spelling: the `license` field of `package.json` and Vite's `build.license`.
- **Protocol.** No bump: `/licences` is a new route, and only the page served with it links to it.
- **fallow audit.** Every new export must be used, by code or tests, in the same commit.
- **Dependencies.** Only the StylesUI update. It comes from GitHub Packages, so run pnpm as `GITHUB_TOKEN=$(gh auth token) pnpm …`.

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | StylesUI 0.3.0; the new `homepage` and `bugs` fields | 1, 2 |
| `tsconfig.web.json` | `resolveJsonModule`, so the web app can import `package.json` | 2 |
| `src/web/components/AboutPopover/appDetails.ts` (new) | The app's details, read from `package.json` and `LICENSE` | 2 |
| `src/web/components/AboutPopover/AboutPopover.tsx` (new) | The info button and the popover | 2 |
| `src/web/components/AboutPopover/AboutPopover.test.tsx` (new) | The popover's content and links | 2 |
| `src/web/components/TopBar/TopBar.tsx`, `TopBar.module.css`, `TopBar.test.tsx` | Renders `AboutPopover` at the bar's right end | 3 |
| `vite.web.config.mts` | Writes `dist/web/licences.md` | 4 |
| `src/server/http/shellRoutes.ts`, `shellRoutes.test.ts` | `GET /licences` | 4 |
| `src/e2e/layout.e2e.ts` | The popover stays in the window; `/licences` lists the bundled packages | 5 |
| `docs/superpowers/specs/2026-10-08-markdown-review-design.md`, `AGENTS.md` | The top bar's About button; the licences file | 6 |

---

### Task 1: Update StylesUI to 0.3.0

- [ ] Run `GITHUB_TOKEN=$(gh auth token) pnpm add -D @krelborn/stylesui`, then `pnpm format`.
- [ ] Check that `InfoIcon` is exported from `node_modules/@krelborn/stylesui/dist/index.d.ts`.
- [ ] Run `pnpm typecheck` and `pnpm test`; both pass unchanged.

### Task 2: AboutPopover

- [ ] In `package.json`, add `"homepage": "https://github.com/Krelborn/markdown-review#readme"` and `"bugs": { "url": "https://github.com/Krelborn/markdown-review/issues" }`, then `pnpm format`.
- [ ] In `tsconfig.web.json`, add `"resolveJsonModule": true`.
- [ ] Write `AboutPopover.test.tsx`, with these tests failing:
  - the button is named "About Markdown Review", and pressing it shows a dialog of the same name
  - the dialog holds "Markdown Review", "Version " followed by `version` from `package.json` (imported in the test), the description, and "© 2026 Matt Styles"
  - `test.each` over the links: "MIT License" goes to `https://github.com/Krelborn/markdown-review/blob/v<version>/LICENSE`, "GitHub" to the `homepage`, "Report an issue" to the issues, and "Third-party licences" to `/licences`, each with `target="_blank"` and `rel="noopener noreferrer"`
- [ ] Write `appDetails.ts`. It exports `appDetails`, an object of `copyright` (the holder after `Copyright (c) ` in `LICENSE`, or undefined), `description`, `issuesUrl`, `licence`, `licenceUrl`, `repositoryUrl` and `version`. `licenceUrl` is the `homepage` without its hash, then `/blob/v<version>/LICENSE`.
- [ ] Write `AboutPopover.tsx`: a ghost, small `IconButton` with the tooltip below it, then a `Popover` holding a `Stack` of the icon, name and version; the description; the licence link and copyright; a `Divider`; and a `Cluster` of the three other links. The copyright line renders only when found.
- [ ] Run the `web` project's `AboutPopover` tests; they pass.

### Task 3: Put the About button in the top bar

- [ ] In `TopBar.test.tsx`, add a `test.each` over a doc and the docs list: the top bar holds the "About Markdown Review" button.
- [ ] In `TopBar.tsx`, render `<AboutPopover />` after the title, and add the button to the doc comment.
- [ ] In `TopBar.module.css`, give `.title` `margin-inline-end: auto`.
- [ ] Run the `web` project's `TopBar` tests; they pass.

### Task 4: Generate and serve the third-party licences

- [ ] In `shellRoutes.test.ts`, add:
  - `GET /licences` serves the web directory's `licences.md` as `text/plain; charset=UTF-8` with `nosniff`
  - `GET /licences` is a 404 `missing-file` when the file is missing
- [ ] In `shellRoutes.ts`, add the route, reading the file with `readTextFileOrNull`.
- [ ] In `vite.web.config.mts`, set `build.license: { fileName: "licences.md" }`.
- [ ] Run `pnpm build`. Check that `dist/web/licences.md` lists `@krelborn/stylesui` with MIT and Lucide's notice, and that `dist/web/assets` holds the four `package.json` fields but not its `devDependencies`.

### Task 5: End-to-end tests

In `src/e2e/layout.e2e.ts`:

- [ ] At the wide and narrow window sizes, opening the About popover shows "Version " followed by the version, and the dialog is fully in the viewport (`toBeInViewport({ ratio: 1 })`).
- [ ] Fetching `/licences` from the page's origin returns plain text that holds `## react - `.
- [ ] Run `pnpm test:e2e`; everything passes, including the test that keeps the header on one line in a very narrow window.

### Task 6: Docs

- [ ] In section 10 of the design spec, add the About button to the "Top bar" list.
- [ ] In `AGENTS.md`, say that `pnpm build` also writes the third-party licences to `dist/web/licences.md`.
- [ ] Run `pnpm verify` and `pnpm exec fallow audit`; both pass.
