# Appearance settings: design spec

- **Date:** 2026-10-11
- **Status:** Design approved in conversation (2026-10-11)
- **Changes:** the top bar, the page's colours, and how code and Mermaid diagrams follow light and dark mode
- **Depends on:** StylesUI 0.5.0, which adds the `paper`, `mist` and `dusk` palettes and the `sunken`, `field` and `overlay` colour tokens

## 1. Problem

1. The page is drawn in StylesUI's `bright` palette: a white page, which has more glare than it needs for long reading. StylesUI 0.5.0 adds `paper`, a warm off-white page that reads more like print.
2. Colour mode follows the operating system, and the user can't change that. Someone with a dark OS who wants a light review page, or the reverse, can't have it.
3. Code and Mermaid diagrams read `prefers-color-scheme` directly. Even if the page could be put in a mode that differs from the OS, they would keep following the OS and come out in the wrong colours.
4. The app's CSS was written for `bright`, where `surface` is darker than the page. In `paper`, `mist` and `dusk`, `surface` is lighter than the page. The comments panel turns near-white and its cards look sunk into it. Code blocks no longer match the inline code and table headers, which StylesUI 0.5.0 draws on the new `sunken` token.

## 2. Intent and success criteria

**Intent:** the review page uses `paper` by default, and the user can choose a colour mode and a palette in a place that is easy to find but stays out of the way.

**Success looks like:**

1. With no choice made, the page is `paper`, and follows the OS between light and dark.
2. From any page, an Appearance button in the top bar opens a popover with the mode (System, Light, Dark) and the palette (Paper, Bright, Mist, Dusk). A choice applies as soon as it is made.
3. The choice is remembered across reloads, server restarts and review rounds, and it is shared by every repo's review server.
4. A reload paints in the chosen colours from the first frame, without a flash of the defaults.
5. In every mode and palette, code is highlighted in the colours meant for the page's mode, and Mermaid diagrams are drawn in the theme for that mode.
6. In every palette, the comment cards stand out from the panel behind them, and code blocks match the inline code and table headers.
7. The canonical text does not change: the conformance test passes, and neither `anchoringVersion` nor `protocolVersion` changes.

## 3. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Where | An Appearance button beside About, which opens a popover | Appearance and About in one "Settings and about" popover; a button that steps through the modes, with the palette in About | Chosen by the user. It is visible on every page but as quiet as About, and keeps the mode and the palette together |
| Default palette | `paper` | `bright`, as now | Chosen by the user. It has the least glare of the full-contrast palettes |
| Palettes offered | `paper`, `bright`, `mist`, `dusk` | Also `pop` | Chosen by the user. `pop` is the `playful` theme's companion palette: it puts hard ink borders on every code block, table and card, and competes with the doc for attention |
| Mode control | A `SegmentedControl`: System, Light, Dark | A `Select`; a toggle | Three short choices, all visible at once. StylesUI's own docs use this example |
| Palette control | A `RadioGroup`, each `Radio` showing a swatch of its palette | A `Select` | The swatch shows the palette before the user picks it. Each swatch is drawn by `Theme`, so it shows the palette in the current mode |
| Storage | Two cookies, one per setting | localStorage | Chosen by the user. Each repo's server has its own port, and localStorage is kept per origin, so a choice in one repo would not reach another. Cookies ignore the port, so every server on `127.0.0.1` sees them |
| Cookie format | `markdown-review-mode` and `markdown-review-palette`, each holding a value from the lists above | One cookie holding JSON | A value that is not on its list falls back to its default on its own, and the values need no encoding |
| First paint | The server writes the attributes into the HTML it serves, from the cookies | A script in the page, before React renders | The page is in the right colours before any script runs. The Content Security Policy allows no inline script |
| Where the attributes go | `data-sui-mode` and `data-sui-palette` on `<html>` | `<Theme mode="system">` around the app, as now | Popovers, the page's canvas and its scrollbars all inherit from `<html>` |
| Resolved mode for Mermaid | `useColorScheme`, from the chosen mode, or from `prefers-color-scheme` under System | Reading `color-scheme` from the page | Mermaid draws with a theme name, so it needs `light` or `dark`. Under System, the CSS `color-scheme` is `light dark`, which names neither |
| Code colours | Shiki with `defaultColor: false`, coloured by `light-dark()` | Keep the media query | `light-dark()` follows the page's `color-scheme`, as StylesUI's tokens do, so code changes with the page's mode |
| CSS target | `build.cssTarget` of Chrome/Edge 123, Firefox 120, Safari 17.5 | Vite's default | StylesUI's README asks for it. Below it, lightningcss rewrites `light-dark()` into variables resolved at `:root`, so colour modes stop nesting. The app's popovers already need newer browsers |

## 4. Layout

```text
+--------------------------------------------------------------------+
| [icon] plan.md v                                            (◐) (i) |  top bar
+--------------------------------------------------------------------+
                                     +-------------------------------+
                                     | Mode                          |
                                     | [ System | Light  | Dark   ]  |
                                     | Palette                       |
                                     | (•) [swatch] Paper            |
                                     |              Warm, low glare  |
                                     | ( ) [swatch] Bright           |
                                     |              White, crisp     |
                                     | ( ) [swatch] Mist             |
                                     |              Cool grey page,  |
                                     |              white cards      |
                                     | ( ) [swatch] Dusk             |
                                     |              Dimmest, softest |
                                     +-------------------------------+
```

The Appearance button sits just left of About, at the right end of the bar, on the All docs page as well as on a doc. Its icon is a circle with one half filled. In a narrow window the doc's file name truncates before either button moves.

## 5. Behaviour

- **Defaults.** Mode `system` and palette `paper`. A setting the user hasn't chosen has no cookie, so a later change to a default still reaches them.
- **Choosing.** Choosing a mode or a palette writes that setting's cookie, applies it to `<html>` at once and leaves the popover open. Choosing one setting does not write the other's cookie.
- **Cookies.** `Path=/`, `SameSite=Strict` and `Max-Age` of 400 days, the most browsers keep. Loading the page writes the stored cookies again, so a setting lasts while the user keeps using the app.
- **Reading.** The server and the page read the cookies with the same function in `src/shared`. A missing value, or one that is not on its list, such as `pop`, falls back to its default.
- **Other tabs.** When a review tab becomes visible again, it reads the cookies again, so a choice made in another tab, for any repo, shows up when the user returns to it.
- **System mode.** Under System, the page follows the OS while it is open: StylesUI's tokens and the code colours through `light-dark()`, and Mermaid by drawing its diagrams again.

## 6. Components, hooks and server

### Shared (`src/shared/appearance/`)

- `Appearance.ts`: the lists of colour modes and palettes, their zod schemas and types, `ColorScheme` (`light` or `dark`), the `Appearance` interface and `defaultAppearance`.
- `appearanceCookies.ts`: `readStoredAppearance(cookies)`, which reads the settings that are stored in a `Cookie` header or `document.cookie`, and `formatAppearanceCookies(settings)`, which gives the `document.cookie` assignment for each setting.

### Server

- `shellRoutes.ts` reads the cookies from the request and adds `data-sui-mode` and `data-sui-palette` to the `<html>` tag of the page it serves. The values come only from the lists, so nothing from the request reaches the HTML unchecked.
- No protocol bump: only the page the same server serves reads the attributes.

### Web (`src/web/appearance/`)

- **`AppearanceContext` and `AppearanceProvider`.** The provider holds the appearance: it starts from the cookies, writes the cookies when it changes, keeps the attributes on `<html>` in step, and reads the cookies again when the tab becomes visible. `App` renders it in place of `<Theme mode="system">`.
- **`useAppearance`.** Gives the appearance and `changeAppearance`, which takes the settings to change. It throws when no provider surrounds the component, like `useReviewApi`.
- **`useColorScheme`.** Gives `light` or `dark`: the chosen mode, or under System what `prefers-color-scheme` says, updated when the OS switches.

### AppearancePopover (new, `src/web/components/AppearancePopover/`)

- **Trigger.** A ghost `IconButton` labelled "Appearance", with the trigger props of `usePopover` and the placement `"bottom"`. Its icon, a circle with its left half filled, is drawn inline and styled like StylesUI's icons, because StylesUI doesn't export the `Icon` component its own icons are built on.
- **Popover.** `role="dialog"` with `aria-label="Appearance"`, holding the `SegmentedControl` labelled "Mode" and the `RadioGroup` labelled "Palette", both controlled by the appearance.
- **Palette radios.** Each `Radio` holds a swatch, a `Theme` with the palette's name that draws the page colour, a line of text and a card on its surface colour, then the palette's name and a few words about it.

### TopBar

Renders `AppearancePopover` before `AboutPopover`.

### Mermaid

- `renderMermaidDiagrams(container, colorScheme)` takes the scheme to draw in, in place of reading `prefers-color-scheme`.
- `useMermaidDiagrams` draws with `useColorScheme`, and draws again when it changes, whether the user chose another mode or the OS switched under System.

### Code

- `loadHighlight` renders with `defaultColor: false`, so Shiki writes both themes' colours as `--shiki-light` and `--shiki-dark` and no colour of its own.
- `global.css` colours `.shiki` and its spans with `light-dark(var(--shiki-light), var(--shiki-dark))`.

### Colours

| Where | Before | After |
| --- | --- | --- |
| Comments panel, wide and as a drawer | `surface` | `background` |
| Thread cards and the new comment form | `background` | `surface`, StylesUI's card colour |
| Code blocks | `surface` | `sunken`, as Prose draws inline code and table headers |
| A code block's language header | `surface` mixed with 5% text | `sunken` mixed with 5% text |

In `bright`, `sunken` is the same as `surface`, so code blocks look as they do now. The panel turns white and the cards light grey.

## 7. Testing

### Unit tests (`node` project)

`appearanceCookies.test.ts`:

- Reads both settings from a cookie header, among other cookies.
- Leaves out a setting that is missing or not on its list, such as `pop`.
- Formats a cookie for each given setting, with `Path=/`, `SameSite=Strict` and a 400-day `Max-Age`.

`shellRoutes.test.ts`:

- Serves the page with the defaults on `<html>` when the request has no cookies.
- Serves the page with the stored settings on `<html>` when the request has the cookies.
- Serves the defaults for a setting whose cookie holds a value that is not on its list.

### Component tests (`web` project, jsdom)

`AppearancePopover.test.tsx`:

- The button is named "Appearance", and pressing it shows a dialog of that name with the mode and the palette, System and Paper selected when there are no cookies.
- It selects the stored settings when the cookies hold them.
- Choosing a mode or a palette puts it on `<html>` and writes only that setting's cookie.

`useMermaidDiagrams.test.tsx`:

- Draws in the light or dark theme for the chosen mode.
- Under System, draws in the theme the OS asks for, and draws again when the OS switches.
- Draws again when the user chooses another mode.

`renderMermaidDiagrams.test.ts` checks that a diagram is drawn in Mermaid's `dark` theme when the scheme is dark. `TopBar.test.tsx` checks that the Appearance button is in the top bar on a doc and on the All docs page.

### End-to-end tests (Playwright, Chromium and WebKit)

In a new `appearance.e2e.ts`:

- With no choice made, the page is `paper` and follows the browser's colour scheme.
- Choosing Dark and Mist changes the page, and a reload keeps them, with the attributes already in the HTML the server sends.
- With the browser in dark mode and the app set to Light, code is coloured with Shiki's light theme and diagrams are drawn in Mermaid's light theme.
- A choice made in one repo's review applies when the same browser opens another repo's review.

## 8. Out of scope

- Drawing Mermaid diagrams in the palette's colours, beyond its light and dark themes.
- The `playful` theme and its fonts.
- The favicon, which keeps following the OS.
- Other settings in the same popover.
