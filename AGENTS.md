# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`, and the web app into `dist/web/`, which the server serves. The web build also writes the licences of the packages it bundles to `dist/web/licences.md`, which the server serves at `/licences`.
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:e2e`: Playwright end-to-end tests in Chromium and WebKit. They build the package first, then run the CLI and the web app together against temporary git repositories. Install the browsers once with `pnpm exec playwright install chromium webkit`.
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve`, `stop` and `install-skill`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `src/e2e/`: Playwright tests in which a user reviews in the browser while the CLI plays the agent.
- `skills/markdown-review/SKILL.md`: the skill that teaches agents the review loop. The build bundles it into `dist/cli.js`, and `install-skill` writes that copy.
- `src/web/`: the React app the server serves, built with `vite.web.config.mts` from `src/web/index.html`. `components/` holds one folder per component; `rendering/` holds the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol. `server.json` and `GET /api/health` are how every version finds that protocol, so they may gain fields but must keep the ones they have.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content. A change that gives the same source different canonical text, such as a new markdown plugin, must also raise `anchoringVersion` in `src/shared/markdown/anchoringVersion.ts`, so threads stored under the old text are re-anchored.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`. `@krelborn/stylesui` comes from GitHub Packages, and `.npmrc` reads a token with `read:packages` from `GITHUB_TOKEN`, so run pnpm as `GITHUB_TOKEN=$(gh auth token) pnpm install`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
