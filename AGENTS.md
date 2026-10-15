# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. Write new specs to `docs/specs/`, named `YYYY-MM-DD-<topic>-design.md`. A spec records the design when its feature was built; later work may change the behaviour, so trust the code over an old spec and leave old specs as they are.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`, and the web app into `dist/web/`, which the server serves. The web build also writes the licences of the packages it bundles to `dist/web/licences.md`, which the server serves at `/licences`.
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/screenshots`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:e2e`: Playwright end-to-end tests in Chromium and WebKit. They build the package first, then run the CLI and the web app together against temporary git repositories. Install the browsers once with `pnpm exec playwright install chromium webkit`.
- `pnpm screenshots`: build the package, then take the screenshots in `docs/images/` again, each in light and dark mode, by playing a scripted review in Chromium. Run it after a change to how the app looks, and check the new images before committing them.
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests. CI also runs `pnpm build` and `pnpm test:e2e`.
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve`, `stop` and `install-skill`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `src/e2e/`: Playwright tests in which a user reviews in the browser while the CLI plays the agent.
- `skills/markdown-review/SKILL.md`: the skill that teaches agents the review loop. The build bundles it into `dist/cli.js`, and `install-skill` writes that copy, with the package version as `metadata.version` in its frontmatter. The CLI calls an installed copy outdated when that version is older than its own, so every release asks for the skill to be reinstalled. Don't put a version in the source file: the package version is the skill's version.
- `src/screenshots/`: the scripted reviews `pnpm screenshots` plays, and the docs they review.
- `site/`: the website, published to GitHub Pages: `index.html`, a tour of the features, and `docs.html`, the manual. Plain HTML, CSS and JavaScript, with no build: open `site/index.html` in a browser to see it. `site/stylesui.css` links to StylesUI's stylesheet in `node_modules`, and `site/images` to `docs/images`; the site builds on StylesUI's tokens but not its React components. `docs.html` repeats the README's usage, so change both together.
- `src/web/`: the React app the server serves, built with `vite.web.config.mts` from `src/web/index.html`. `components/` holds one folder per component; `rendering/` holds the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol. `server.json` and `GET /api/health` are how every version finds that protocol, so they may gain fields but must keep the ones they have.

## Releasing

Publishing a GitHub release stages that version on npm, and a maintainer approves it there.

1. In a pull request, set `version` in `package.json`, and merge it.
2. Publish a GitHub release from `main`, tagged `v<version>`. Mark it as a pre-release exactly when the version has a pre-release part, such as `0.2.0-beta.1`.
3. `.github/workflows/publish.yml` checks that the tagged commit is on `main` and that the tag matches `package.json`, runs `ci.yml` on that commit, then builds the package and packs it with `pnpm pack`. A separate `publish` job, which checks nothing out and installs nothing, runs `npm stage publish` on that tarball through npm trusted publishing, with the dist-tag `next` for a pre-release and `latest` otherwise.
4. Approve the staged version with 2FA in the Staged Packages tab of the package on npmjs.com, or with `npm stage approve <stage-id>`, which needs npm 11.15 or later (`npx npm@latest stage approve <stage-id>`); the publish job's log has the id. Check the version and dist-tag first: npm won't stop an older version from taking `latest`. Nothing is public until then, and `npm stage reject <stage-id>` withdraws it.

The trusted publisher on npmjs.com names the workflow `publish.yml` and the environment `npm`, and allows neither `npm publish` nor `npm dist-tag`, so every version waits for approval. Only the `publish` job runs in `npm`: npm checks the name of the calling workflow, so without the environment the site job, which gets an OIDC token to deploy, could publish too. The `npm` environment accepts only `v*` tags, and the jobs that build what ships use no cache, since a poisoned cache would ship in the package.

Once a release that isn't a pre-release is staged on npm, `publish.yml` also publishes the site from the release's commit, through `.github/workflows/pages.yml`, so the site describes the version on npm. To publish a fix to the site between releases, run that workflow by hand from `main`, but only while `main` describes nothing npm doesn't have yet; otherwise the fix goes out with the next release. Before the first release that publishes the site, enable GitHub Pages in the repository's settings with the source "GitHub Actions", and add the tag rule `v*` to the deployment branches and tags of the `github-pages` environment, since a release deploys from its tag.

Every workflow pins its actions to a full commit SHA, with the version in a trailing comment, and the repository requires it, so an action referred to by tag fails. Dependabot (`.github/dependabot.yml`) checks the actions weekly and opens one grouped pull request to update them, skipping releases younger than a week.

If a job fails on something transient, such as a flaky e2e test, use "Re-run failed jobs" on the run's page. If the check or CI fails for a real reason, nothing reached npm: delete the release and its tag, fix `main`, and release the same version again. If the site job fails, the version is already staged on npm, so keep the release and its tag: fix the setting and re-run the failed job, or fix `main` and run `pages.yml` by hand from it.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the conformance test (`pnpm vitest run --project web src/web/rendering/blockConformance.test.ts`) after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content. A change that gives the same source different canonical text, such as a new markdown plugin, must also raise `anchoringVersion` in `src/shared/markdown/anchoringVersion.ts`, so threads stored under the old text are re-anchored.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`. `pnpm-workspace.yaml` sets `minimumReleaseAge`, so pnpm won't resolve a version published less than a week ago, except of our own `@krelborn` packages. A package only the web app imports is a devDependency, since the build bundles it into `dist/web`; one the CLI or server imports is a dependency. fallow can't tell the bundled web app from code that runs from an install, so list each devDependency the web app imports in `ignoreDependencies` in `.fallowrc.json` as well; fallow then won't notice if the CLI or server imports it.

Run `pnpm install` first in a new clone or worktree: husky creates the hooks in `.husky/_` during install, and until then commits skip lint-staged and `fallow audit` without warning.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. `.claude/settings.json` enables the `fallow@fallow-skills` plugin, which provides its skills to Claude Code on your machine. Cloud sessions don't install plugins a repository enables, so there, and in other agents, read the skill at `node_modules/fallow/skills/fallow/SKILL.md` after `pnpm install`; the husky hook below runs `fallow audit` without the plugin. `.mcp.json` and `.codex/config.toml` start its MCP server.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
