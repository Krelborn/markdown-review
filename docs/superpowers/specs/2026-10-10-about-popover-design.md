# About popover: design spec

- **Date:** 2026-10-10
- **Status:** Design approved in conversation (2026-10-10), ready for spec review
- **Changes:** the top bar in section 10 (Browser UI) of the [design spec](2026-10-08-markdown-review-design.md)
- **Depends on:** a StylesUI release with `InfoIcon` and a licence (section 7)

## 1. Problem

1. The web app says nothing about itself. To report a bug, a user has to find the version some other way, and nothing in the app links to the repository or its issues, which the README invites.
2. The npm package bundles 93 third-party packages into `dist/web`, minified, with every licence comment stripped. Most of their licences (MIT, ISC, BSD, Apache-2.0) ask for their notices to be included, and the package includes none of them.

## 2. Intent and success criteria

**Intent:** basic information about the app is one click away from every page, and out of the way until the user wants it.

**Success looks like:**

1. From any page, at any width, the user can see the app's version with one click.
2. The same place shows the app's name, its licence, and links to the repository, its issues and the third-party licences.
3. Everything already in the top bar looks and works as before.
4. The npm package includes the notices of every third-party package bundled into the web app.
5. The version, licence and links come from `package.json` and `LICENSE`, so a release updates them without code changes.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Where | An info button at the right end of the top bar, which opens a popover | The app's icon as a menu; a footer on the All docs page; an About page | Chosen by the user. One click from every page, in the part of the bar that is empty now, and it changes nothing that works today |
| Icon | `InfoIcon`, added to StylesUI | Drawn locally like `AppIcon`; `MoreHorizontalIcon` | Chosen by the user. Icons belong in StylesUI with the others, and "…" would suggest a menu of actions |
| Third-party licences | A file that Vite's `build.license` generates, served at `/licences` and linked from the popover | An in-app page; leaving them out | Chosen by the user. The file is generated from the packages that are actually in the bundle, so it stays in step with the lockfile |
| Licences file format | Markdown, served as `text/plain` | `text/markdown`; JSON | Every supported browser displays `text/plain`, but some download `text/markdown`. The generated markdown reads well as plain text |
| Version source | `package.json`, read at build time | `GET /api/health`, which already reports it | The server serves the bundle from its own package, so the two always agree, and the popover needs no request and no loading state |
| Reading `package.json` | Named imports of its fields, and `LICENSE` imported with `?raw` | A constant passed through Vite's `define` | Vite drops the fields nothing imports, so the bundle doesn't include the rest of `package.json`, and Vitest reads the same imports with no extra configuration. The cost is the 1 KB text of `LICENSE` in the bundle |

## 4. Layout

```text
+--------------------------------------------------------------------+
| [icon] plan.md v                                               (i) |  top bar
+--------------------------------------------------------------------+
                                     +-------------------------------+
                                     | [icon] Markdown Review        |
                                     |        Version 0.1.0          |
                                     | Review agent-written markdown |
                                     | in the browser and hand the   |
                                     | comments back to the agent    |
                                     | MIT License                   |
                                     | © 2026 Matt Styles            |
                                     |-------------------------------|
                                     | GitHub   Report an issue        |
                                     | Third-party licences          |
                                     +-------------------------------+
```

The button sits at the right end of the bar at every width, on the All docs page as well as on a doc. In a narrow window the doc's file name truncates before the button moves.

## 5. Content

| Item | Shown as | Source |
| --- | --- | --- |
| Name | "Markdown Review", beside `AppIcon` | The display name the icon link already uses |
| Version | "Version 0.1.0" | `version` in `package.json` |
| Description | One sentence | `description` in `package.json` |
| Licence | "MIT License", linking to `LICENSE` at the release's tag, `v<version>` | `license` in `package.json`, followed by "License" |
| Copyright | "© 2026 Matt Styles" | The `Copyright` line of `LICENSE` |
| GitHub | A link | `homepage` in `package.json`, a new field |
| Report an issue | A link | `bugs.url` in `package.json`, a new field |
| Third-party licences | A link to `/licences` | `build.license` in the web build |

The new `package.json` fields are `"homepage": "https://github.com/Krelborn/markdown-review#readme"` and `"bugs": { "url": "https://github.com/Krelborn/markdown-review/issues" }`. npm's package page uses them too.

`src/web/components/AboutPopover/appDetails.ts` imports these fields by name from `package.json`, which needs `resolveJsonModule` in `tsconfig.web.json`, and reads the copyright line from `LICENSE`, imported with `?raw`. The component test checks that the copyright line is found, and the release workflow runs the tests before it publishes.

## 6. Components and server

### AboutPopover (new, `src/web/components/AboutPopover/`)

- **Trigger.** A ghost `IconButton` labelled "About Markdown Review", holding `InfoIcon`, with the trigger props of `usePopover`. The placement is `"bottom"`.
- **Popover.** `role="dialog"` with `aria-label="About Markdown Review"`, holding the content in section 5, in that order. The app's name is bold text, not a heading, like the title of the Submit popover.
- **Links.** Every link opens in a new tab, with `rel="noopener noreferrer"`, like the external links in a doc. This includes Third-party licences, so following a link never leaves the review page and never triggers the unsaved-text warning.
- **Positioning.** StylesUI centres a popover on its trigger with `justify-self: anchor-center`. The Submit popover already opens this way from a button at the window's right edge. The end-to-end test checks that the About popover stays inside the window too.
- **Closing.** Escape and a click outside close it, and focus returns to the button, as with the other StylesUI popovers.

### TopBar

- Renders `AboutPopover` after the title. The title's `margin-inline-end: auto` pushes it to the right end.
- The title keeps `min-inline-size: 0`, and the button doesn't shrink, so a long file name truncates instead of pushing the button off the bar.
- Its doc comment adds the About button.

### Build

- `vite.web.config.mts` sets `build.license: { fileName: "licences.md" }`, which writes `dist/web/licences.md`. A build today would list 93 packages in about 175 KB.
- `dist/web/licences.md` ships in the npm package, because `files` already includes `dist`.
- The CLI build is unchanged.

### Server

- `shellRoutes.ts` adds `GET /licences`. It serves `<webDirectory>/licences.md` as `text/plain; charset=utf-8` with `X-Content-Type-Options: nosniff`, or a 404 `missing-file` error when the file is missing, as it is in builds made for tests.
- It is not served from `/assets/`, which serves everything except JS and CSS as `application/octet-stream`, so the browser would download it.
- No protocol bump. The route is new, and only the page served with it links to it.

## 7. StylesUI prerequisites

In the StylesUI repository, released before this work:

1. **`InfoIcon`.** Lucide's `info` icon (a circle with `r="10"`, `M12 16v-4` and `M12 8h.01`), added the same way as the other icons: a doc comment, the Lucide attribution comment, the export, a story and a test.
2. **The MIT licence.** StylesUI has neither a `license` field nor a `LICENSE` file. The generated file therefore lists `@krelborn/stylesui` with no licence. It also leaves out Lucide's ISC notice, because the notice is in StylesUI's `THIRD_PARTY_NOTICES.md` and Vite reads only files named `LICENSE`, `LICENCE` or `COPYING`. StylesUI's code ships inside this package's public npm release, so it takes the same licence, chosen by the user. StylesUI needs:
   - `"license": "MIT"`
   - a `LICENSE` file with the MIT licence, followed by the Lucide and Feather notices, which move there from `THIRD_PARTY_NOTICES.md` so there is one copy. npm publishes `LICENSE` whatever `files` says

Then markdown-review updates StylesUI with `pnpm add -D @krelborn/stylesui`, with no hand-written version, and runs `pnpm format`.

## 8. Testing

### Component tests (`web` project, jsdom)

`AboutPopover.test.tsx`:

- The button is named "About Markdown Review".
- Pressing it shows a dialog named "About Markdown Review" that holds the name, "Version " followed by the version in `package.json`, the description and the copyright line.
- The links and where they go:
  - "MIT License" goes to `LICENSE` at the version's tag
  - "GitHub" goes to the `homepage`
  - "Report an issue" goes to the issues
  - "Third-party licences" goes to `/licences`
- Every link opens in a new tab with `rel="noopener noreferrer"`.

`TopBar.test.tsx` adds that the About button is in the top bar on a doc and on the All docs page.

### Server tests (`node` project)

`shellRoutes.test.ts`:

- `GET /licences` serves the web directory's `licences.md` as `text/plain; charset=utf-8` with `nosniff`.
- `GET /licences` is a 404 when the file is missing.

### End-to-end tests (Playwright, Chromium and WebKit)

In `layout.e2e.ts`:

- At the wide, narrow and very narrow widths, opening the About popover shows the version, and the popover lies inside the viewport.
- Following Third-party licences opens a tab that lists `react` and `@krelborn/stylesui`. The end-to-end tests build the package, so the file exists.

## 9. Docs to update

- **Design spec, [section 10](2026-10-08-markdown-review-design.md#10-browser-ui).** The "Top bar" list adds the About button, its contents and the `/licences` file.
- **AGENTS.md.** The `pnpm build` line adds that the web build writes the third-party licences to `dist/web/licences.md`.

## 10. Out of scope

- An in-app page for the third-party licences.
- Telling the user when a newer version is available.
- A list of keyboard shortcuts, or other help, in the same popover.
- Showing the server's details, such as its root, pid or protocol.
