# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm test`: unit tests (`node` project for `src/cli`, `src/server` and `src/shared`; `web` project in jsdom for `src/web`)
- `pnpm test:coverage`: unit tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store.
- `src/web/`: browser code: the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
