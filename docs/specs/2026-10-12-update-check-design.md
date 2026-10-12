# Update check: design spec

- **Date:** 2026-10-12
- **Status:** Approved in spec review (2026-10-12)
- **Changes:** the CLI's `open`, `poll` and `inbox` output, the skill, the review server's startup, and the About popover
- **Changes nothing in:** the store or the agent routes. It adds one browser route, which only the web app of the same build calls, so `protocolVersion` does not change. The canonical text does not change, so `anchoringVersion` does not change.

## 1. Problem

1. **Nobody learns of a new version.** Users install markdown-review with `npm install --global` and keep that version until they think to update. Nothing tells them, or their agent, that a newer one is out.
2. **`npx` users go stale too.** `npx @krelborn/markdown-review` runs whatever version npx cached first, unless the user writes `@latest`.
3. **The installed skill goes stale.** `install-skill` writes a copy of the skill bundled in `dist/cli.js`. After an update, that copy still describes the old version, and nothing notices.
4. **An update doesn't reach a running server.** `connectToServer` only replaces a server with an older protocol. After an update that keeps the protocol, the old server keeps serving the old web app until it goes idle.

## 2. Assumptions

1. **The package is on the public npm registry.** `GET https://registry.npmjs.org/-/package/@krelborn%2fmarkdown-review/dist-tags` answers `{"latest":"0.3.0"}`, checked on 2026-10-12. An unknown package answers 401.
2. **Most users install it globally with npm, or run it with npx.** Other package managers, version managers and `sudo` exist. The agent adapts the command once the user tells it what they use.
3. **macOS and Linux only**, as in the [design spec](2026-10-08-markdown-review-design.md).
4. **One spec, not a capability map.** The CLI notice, the stale-skill notice and the browser notice share one check and ship as one feature.

## 3. Objective and success criteria

**Objective:** when a newer markdown-review is published, the user hears about it from their agent and in the browser, and the agent can update it for them once they agree, without interrupting a review.

**Success looks like:**

1. **Check.** The review server asks the npm registry for the dist-tags at most once a day across all repos, without delaying startup or any request. A failed or slow check (3 seconds at most) changes nothing a user sees.
2. **Notice on `open`.** When a newer version is known, `open` prints an `update_available` line saying which version is out and that the agent should offer it once the review is approved.
3. **Offer on approval.** When the review is approved, `poll` and `inbox` print `update_available` again, with the exact commands to run. The agent asks the user, and runs them only if the user agrees.
4. **Stale skill.** When an installed copy of the skill, in the repo or in the home directory, differs from the copy this CLI bundles, `open` and the approved output print a `skill_outdated` line with the `install-skill` command that refreshes it.
5. **Browser.** The About button shows a dot, and the About popover says which version is available and the command that installs it.
6. **Opt-out.** With `MARKDOWN_REVIEW_NO_UPDATE_CHECK=1`, `NO_UPDATE_NOTIFIER` or `CI` set, nothing contacts the registry and no `update_available` line or browser notice appears. The stale-skill notice still appears, as it needs no network.
7. **Nothing else moves.** `pnpm verify`, `pnpm build`, `pnpm test:e2e` and `fallow audit` pass. No test contacts the real registry.

## 4. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Who checks | The review server, in the background after it starts | The CLI, on every command; `update-notifier` | The server is long-lived and detached, so the check never slows a command. `update-notifier` shows its notice in an interactive terminal, and agents run the CLI without one |
| How the CLI learns the result | It reads the shared cache file and compares the latest version with its own | A new field on `GET /api/health` | No API change, and the CLI compares with its own version, which can differ from an older server's of the same protocol |
| Where the result is kept | `$XDG_CACHE_HOME/markdown-review/update-check.json`, or `~/.cache/markdown-review/update-check.json` | `.markdown-review/` in each repo | One check a day for the user, however many repos they review in |
| What it asks the registry | `GET <registry>/-/package/@krelborn%2fmarkdown-review/dist-tags` | The full packument; `/<package>/latest` | One small response with both `latest` and `next` |
| Which registry | `https://registry.npmjs.org`, or `MARKDOWN_REVIEW_REGISTRY_URL` when set | `npm_config_registry` | The package is only on npmjs. The repo's own `.npmrc` points `@krelborn` at GitHub Packages, which would mislead a check run from a dev script. The variable lets tests use a stub registry |
| Which tag counts | `latest`. A pre-release install also considers `next`, and takes the higher of the two | `latest` only | A user on `0.4.0-beta.1` wants to hear of `0.4.0-beta.2` and of `0.4.0` |
| Version comparison | A small local `compareVersions` that follows semver precedence, and reports nothing for a version it cannot parse | The `semver` package | Only `x.y.z` and `x.y.z-pre` occur here; it saves a runtime dependency. Revisit if it grows |
| When the agent offers | Mention once on `open`; ask after the user approves | Ask as soon as it is seen | Chosen by the user. An update stops the server, so it must not land mid-review |
| Who runs the update | The agent, after the user agrees | The CLI updates itself | A global install may need `sudo` or a version manager the CLI cannot see, and the user should agree to changes to their machine |
| Picking up the new server | The update commands include `markdown-review stop` | Replace any server of an older version, not only an older protocol | Replacing a server automatically could cut off a `poll` in another session. After approval, stopping is safe |
| npx | The commands say to run `npx @krelborn/markdown-review@latest` from now on | Treat it as a global install | Installing globally isn't what an npx user chose |
| How the CLI tells npx from a global install | `_npx` in the real path of `dist/cli.js` | `npm_config_user_agent`; `npm_execpath` | The path is set by where npx unpacks packages. The environment variables also appear when a global install runs from an npm script |
| Linked source checkouts | No special case | Detect the checkout and stay quiet | A checkout is at or ahead of the released version, so it hears nothing anyway |
| Stale skill detection | `install-skill` writes the package version to the skill's frontmatter as `metadata.version`, and a copy is stale when that version is older than the running one, or missing | Compare each installed `SKILL.md` with the bundled one, byte for byte; a version kept by hand in the source `SKILL.md` | A byte comparison calls a newer or edited copy stale, so the agent would overwrite a newer skill with an older one. `metadata` is the Agent Skills spec's place for a skill's own fields, and Claude Code ignores it. Writing it at install time means nothing needs bumping by hand |
| Browser notice | A dot on the About button, and a line in the About popover | A page alert under the top bar | Chosen by the user. It never gets in the way of reading |
| When the browser learns of an update | It asks once when the page loads. The route waits for a check in progress | Push it over the event stream | The page usually loads just as the server starts, so the check is often in flight. Waiting up to its 3-second timeout covers that, and a later update can wait for the next load |

## 5. Behaviour

### The check

- The server starts the check after it writes `server.json`. It doesn't await it.
- If the cache file's `checkedAt` is less than 24 hours old, it uses the cache and asks no one. Otherwise it fetches the dist-tags, with a 3-second timeout.
- On success it writes `{ "checkedAt": <ISO time>, "distTags": { "latest": "0.4.0", "next": "0.5.0-beta.1" } }` atomically. It validates the response with zod and ignores tags other than `latest` and `next`.
- On failure (network error, timeout, non-2xx status, invalid body) it writes `checkedAt` with the previous `distTags`, or none, so the next attempt waits a day. It logs a warning to `server.log`.
- A running server checks again 24 hours after its last check. A server that goes idle within 30 minutes rarely gets there, and the next one to start does the check.
- When opted out (`MARKDOWN_REVIEW_NO_UPDATE_CHECK=1`, `NO_UPDATE_NOTIFIER` or `CI` set), the server neither reads nor writes the cache and never fetches.

### The available update

`findAvailableUpdate(current, distTags)` returns the version to offer, or `null`:

- `null` when `current` or every candidate tag can't be parsed.
- For a release `current`, `latest` when it is higher than `current`.
- For a pre-release `current`, the higher of `latest` and `next` when that is higher than `current`.

### CLI output

The CLI reads the cache file directly, compares it with its own `packageVersion`, and adds lines before `next_step`. It never fetches anything.

`open`, when an update is available:

```
Opened docs/plan.md for review: http://127.0.0.1:4823/document/docs/plan.md
Opened in the user's browser.

update_available: markdown-review 0.4.0 is out; this is 0.3.0. Tell the user, and offer to update once they approve the review.

next_step: Run `markdown-review poll` to wait for the user's comments. ...
```

`poll` and `inbox`, once the review is approved, for a global install with the skill installed globally:

```
Review approved.

update_available: markdown-review 0.4.0 is out; this is 0.3.0. Ask the user whether to update. If they agree, run `npm install --global @krelborn/markdown-review@latest`, then `markdown-review stop`, then `markdown-review install-skill --global`.

next_step: The user approved the review. Carry on with your task; ...
```

- For npx, the commands are `npx @krelborn/markdown-review@latest stop` and `npx @krelborn/markdown-review@latest install-skill [--global]`, and the line says to use `npx @krelborn/markdown-review@latest` from now on.
- The commands name the dist-tag the newer version came from: `@latest`, or `@next` when a pre-release install is offered a newer pre-release, so following them never installs an older version. `skill_outdated` for npx runs the running version, as `npx @krelborn/markdown-review@<version> install-skill`.
- The `install-skill` commands are one per installed copy: none when no copy is installed, `install-skill` for the repo's, `install-skill --global` for the home directory's.

`skill_outdated`, when an installed copy is from an older version and no update is available:

```
skill_outdated: The markdown-review skill at /repo/.claude/skills/markdown-review/SKILL.md is older than this version (0.3.0). Once the user approves the review, run `markdown-review install-skill`. The new skill loads in the next agent session.
```

When an update is available, the `update_available` line's `install-skill` commands cover the stale copies, and no `skill_outdated` line appears.

### The skill

A new section in `skills/markdown-review/SKILL.md`, after "Approval":

```markdown
## Updates

- `open` may print `update_available` when a newer markdown-review is out. Tell the user, and carry on with the review.
- Once the review is approved, `poll` and `inbox` print `update_available` again with the commands to run. Ask the user whether to update, and run them only if they agree. If they install packages another way, such as with pnpm or under `sudo`, adapt the install command and keep the rest.
- `skill_outdated` means an installed copy of this skill is from an older version. Once the review is approved, run the command it gives and tell the user.
```

### Browser

- `GET /api/update`, a browser route, answers `{ "availableVersion": "0.4.0" | null, "command": string | null }`, validated by `updateResponseSchema` in `src/shared/api/apiResponseSchemas.ts`. The server works it out from the cache and its own version, and waits for a check in progress. `command` is the global install command, or null when markdown-review runs through npx.
- The web app fetches it once on load. When `availableVersion` isn't null:
  - The About button shows a small dot in the `primary` colour, and its label becomes "About Markdown Review, update available".
  - The popover shows, under "Version 0.3.0": "Version 0.4.0 is available. Ask your agent to update it, or run" followed by the command in a `<code>`. With no command, for npx, it ends at "Ask your agent to update it."
- When the fetch fails, the About button and popover look as they do now.

## 6. Commands

```
GITHUB_TOKEN=$(gh auth token) pnpm install   # once, in a new worktree
pnpm verify                                  # lint, format check, typecheck, tests
pnpm build
pnpm test:e2e
pnpm vitest run --project node src/server/update
pnpm vitest run --project web src/web/components/AboutPopover
pnpm vitest run --project integration src/integration/updateCheck.integration.test.ts
pnpm exec fallow audit
```

Try it by hand, with a cache that claims a newer version:

```
pnpm build
export XDG_CACHE_HOME=$(mktemp -d) MARKDOWN_REVIEW_NO_BROWSER=1
mkdir -p "$XDG_CACHE_HOME/markdown-review"
echo "{\"checkedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"distTags\":{\"latest\":\"9.9.9\"}}" > "$XDG_CACHE_HOME/markdown-review/update-check.json"
node dist/cli.js open README.md
```

## 7. Project structure

| Path | What |
| --- | --- |
| `src/server/update/semanticVersions.ts` | `compareVersions` and `isPrerelease`: semver precedence for `x.y.z` and `x.y.z-pre` |
| `src/server/update/findAvailableUpdate.ts` | The version to offer, from the current version and the dist-tags |
| `src/server/update/updateCheckFileSchema.ts` | zod schemas of the dist-tags and the cache file |
| `src/server/update/readUpdateCheckFile.ts` | Reads the cache file, or null |
| `src/server/update/updateCheckSettings.ts` | The cache file's path, the registry's URL, and whether the environment opts out |
| `src/server/update/fetchDistTags.ts`, `RegistryRequestError.ts` | The registry request, with its timeout and validation |
| `src/server/update/UpdateChecker.ts` | Runs the daily check, writes the cache, and answers what is recorded, waiting for a check in progress |
| `src/server/update/installCommands.ts` | `findInstallKind`, the command to run markdown-review for an install kind, and the global install command |
| `src/server/http/updateRoutes.ts` | `GET /api/update` |
| `src/server/runtime/runServer.ts` | Starts the `UpdateChecker`; `RunServerOptions` gains it so tests can pass their own |
| `src/cli/skillInstallPath.ts` | Where `install-skill` writes the skill under a repo or home directory |
| `src/cli/skillStamps.ts` | Writes the installing version to the skill's `metadata.version`, and reads it back |
| `src/cli/findInstalledSkills.ts` | Installed skill copies, and whether each is from the running version or a newer one |
| `src/cli/formatUpdateNotices.ts` | The `update_available` and `skill_outdated` lines |
| `src/cli/readUpdateNotices.ts` | Reads the cache and the installed skills, and formats the notices |
| `src/cli/commands/openCommand.ts`, `pollCommand.ts`, `inboxCommand.ts` | Print the notices |
| `src/web/api/useAvailableUpdate.ts` | Asks `GET /api/update` once when the page loads |
| `src/web/components/AboutPopover/` | The dot and the popover line |
| `skills/markdown-review/SKILL.md` | The Updates section |
| `src/integration/updateCheck.integration.test.ts` | The CLI and server against a stub registry |
| `README.md` | The opt-out variables, and that the server contacts the npm registry once a day |

`installSkillCommand` and `findInstalledSkills` share the skill's install path through `skillInstallPath`.

## 8. Code style

The repository's TypeScript, comments, React and Vitest standards apply, as loaded by the `coding-standards` plugin. Full words in names, explicit return types on exports, contract-only doc comments, one class per module, and zod at every boundary: the registry response, the cache file and the route's response. For example:

```ts
import { compareVersions } from "./compareVersions";
import type { DistTags } from "./updateCheckFileSchema";

/**
 * Picks the published version to offer in place of the running one
 *
 * @param current the running version
 * @param distTags the registry's `latest` and `next` tags
 * @returns the version to offer, or null when none is newer or a version cannot be read
 */
export function findAvailableUpdate(current: string, distTags: DistTags): string | null {
  const candidates = current.includes("-") ? [distTags.latest, distTags.next] : [distTags.latest];
  let best: string | null = null;
  for (const candidate of candidates) {
    if (candidate !== undefined && (compareVersions(candidate, best ?? current) ?? 0) > 0) {
      best = candidate;
    }
  }
  return best;
}
```

## 9. Testing

- **Unit (`node` project):**
  - `compareVersions`: release order, pre-release before release, numeric and alphanumeric identifiers, unparseable input.
  - `findAvailableUpdate`: up to date, newer `latest`, pre-release install with newer `next` and with newer `latest`, missing tags.
  - `UpdateChecker`, with an injected `fetch`, clock and cache path: a fresh cache asks no one; a stale cache fetches and writes; a failure keeps the old tags and waits a day; a slow fetch times out; opted out, nothing reads, writes or fetches; a caller during a check waits for it.
  - `installCommands`, `formatUpdateNotices`, `findInstalledSkills`, and the route in `updateRoutes.test.ts`.
- **Web (`web` project):** the About button and popover with and without an available update, and when the fetch fails.
- **Integration:** `startCli` sets `HOME` to a `.home` directory inside the test repository, clears `XDG_CACHE_HOME`, and sets `MARKDOWN_REVIEW_NO_UPDATE_CHECK=1`, so no other test reads the user's cache or skill or contacts the registry. The `node` test project sets `MARKDOWN_REVIEW_NO_UPDATE_CHECK=1` too, for the servers its tests start. `updateCheck.integration.test.ts` clears the opt-out and points `MARKDOWN_REVIEW_REGISTRY_URL` at a local stub. It checks that the server writes the cache, that `open` prints `update_available`, that the approved `inbox` prints the commands, and that a changed installed skill prints `skill_outdated`.
- **End-to-end:** one Playwright test with a seeded cache file shows the dot and the popover line. The e2e harness sets the same environment as `startCli`.

## 10. Boundaries

- **Always:** keep every check off the path of a command or request; treat every failure as "no update known"; keep the tests off the real registry; run the conformance and `fallow audit` checks before committing.
- **Ask first:** adding a dependency, such as `semver`; changing `server.json`, `/api/health` or `protocolVersion`; making the CLI replace a server because of its version.
- **Never:** update the package, stop the server or rewrite a skill without the user agreeing through the agent; send anything to the registry beyond the dist-tags request; break the review when the network is down.

## 11. Open questions

1. **A per-repo install.** A repo that has markdown-review as a devDependency gets the global command, which updates the wrong copy. Detect `node_modules` under the repo root and offer `npm install --save-dev @krelborn/markdown-review@latest`, or leave it to the agent to adapt?
2. **Repeated offers.** `inbox` after approval prints `update_available` each time it runs. Is that acceptable, or should a declined offer be remembered for that version?
