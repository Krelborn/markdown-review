# Markdown Review: design spec

- **Date:** 2026-10-08
- **Status:** Revised after spec review (2026-10-08), ready for implementation planning
- **Working name:** `markdown-review` (files, CLI, storage); **Markdown Review** (display name)

## 1. Summary

Markdown Review lets a person review agent-written markdown documents in a browser, comment on specific passages, and have a coding agent (Claude Code, OpenCode, or any agent with a shell tool) pick those comments up, edit the files, and answer each comment. It is a local tool: one CLI package that starts a small per-repo server and a browser app.

It is inspired by [lavish-axi](https://github.com/kunchenguid/lavish-axi), which does the same for HTML artifacts. The key ideas taken from it:

- The agent connects through an ordinary CLI command, not an MCP server or a harness plugin.
- A command that waits for the human (`poll`) is the bridge.
- Every CLI response includes a `next_step` hint that teaches the agent the workflow.

The key ways this design differs from lavish-axi:

- Comments are anchored to source line ranges in the `.md` file, which an agent can act on directly, rather than to DOM selectors.
- Comments are persistent threads with open and resolved states, rather than a queue that is consumed on delivery.
- Review is repo-wide, so a person can move between linked docs (spec, plan, design notes) and comment on the set as a whole.

## 2. Intent and success criteria

**Who it is for:** one developer reviewing plans, specs and design docs that their coding agent wrote, inside a git repo, on their own machine.

**Success looks like:**

1. The agent opens a doc for review with one command, and the browser shows it rendered.
2. The user comments on passages, whole blocks, whole docs or the review as a whole, across several linked docs, then submits.
3. The agent receives each comment with file, 1-based line range, quoted text and the user's words, either by waiting (`poll`) or by checking later (`inbox`).
4. The agent edits the files; the browser re-renders in place and comment highlights follow their text, including after edits made while the server was not running.
5. The agent resolves or replies to each thread; the user sees which points were addressed and can reopen any thread by replying.
6. The user approves the review, with or without comments, and the agent learns this from `poll` or `inbox` and carries on with its task.

## 3. Scope

### Goals (MVP)

- Render a repo's markdown docs in a local browser app.
- Comment on passages, blocks, docs and the review; draft, then submit in one batch, either requesting changes or approving.
- Threads with open, resolved and outdated states, and replies from both sides.
- Agent CLI: `open`, `inbox`, `poll`, `reply`, `resolve`, `stop`, `install-skill`.
- Live re-render when the agent edits a doc, with comments re-anchored.
- An Agent Skills `SKILL.md` that teaches agents the workflow, and a command that installs it.

### Non-goals (MVP)

- Editing documents in the browser. The `.md` file on disk is the source of truth and only the agent edits it.
- Multiple simultaneous human reviewers or real-time collaboration.
- Agent-created threads. The agent replies to and resolves threads; only the user starts them.
- Hosting, accounts, sharing or export.
- MCP server, harness plugins and SessionStart hooks.
- Front matter rendering, footnotes, math.
- A full file-tree browser.
- Windows. The MVP supports macOS and Linux.

Human editing in the browser is a likely post-MVP feature. The data model must not rule it out, but nothing is built for it now.

## 4. Decisions log

| # | Decision | Chosen | Main reason |
|---|---|---|---|
| 1 | Source of truth | The `.md` file on disk, edited only by the agent | Avoids markdown round-tripping and two-writer conflicts |
| 2 | Delivery to the agent | Both a waiting `poll` and a non-waiting `inbox`, over one comment store | Covers live review and "address the comments later" |
| 3 | Comment lifecycle | Per-comment threads; agent resolves each with a note; a user reply reopens | Shows which points were actually addressed |
| 4 | Storage | One `.markdown-review/` directory at the repo root, mirroring doc paths; git-ignored unless the user opts in to committing it | Agent-readable and path-stable; committed open threads would reach the agent in every clone |
| 5 | Review scope | Repo-wide: any `.md` in the repo; linked docs navigate in-app | Docs link to each other and are reviewed as a set |
| 6 | Architecture | Browser app renders markdown; server owns state and re-anchoring | Stateful sidebar suits a component framework; agent and browser agree on positions |
| 7 | Comment layout | Fixed sidebar plus highlights and numbered markers in the doc | Natural home for whole-review and outdated threads; simplest to build |
| 8 | Ending a review | Submit as "Request changes" or "Approve"; approval is stored per review round and reported by `poll` and `inbox` | The agent needs a signal to stop waiting, even when the user has no comments |
| 9 | When re-anchoring runs | On any read of a doc's threads whose stored source hash differs from the file on disk; the watcher only triggers pushes | Line numbers stay right after edits made while the server was stopped or before the watcher fires |
| 10 | Anchor text model | One canonical block text, computed from markdown-it tokens by code shared by server and browser; anchors are offsets into it | Browser selections and server matching agree exactly |
| 11 | Comment channel integrity | Agent routes need a per-server token; repo files are served sandboxed | Comments are instructions to an agent that has a shell |
| 12 | Tooling | The StylesUI and pull-request-assistant toolchain: pnpm, TypeScript 7, oxlint, oxfmt, Vite, Vitest | One toolchain across the author's projects |

## 5. Architecture

```
Agent (Claude Code, OpenCode, ...)
  │  runs CLI commands through its shell tool
  ▼
markdown-review CLI ──HTTP──► Local server (one per repo, 127.0.0.1 only)
                                ├─ Store: reads and writes .markdown-review/**/*.json
                                ├─ Anchorer: re-anchors a doc's threads when its source hash changes
                                ├─ Watcher: notices doc changes and triggers pushes
                                └─ Event bus: wakes waiting polls, pushes to browsers
                                       │ JSON API  ▲  SSE push
                                       ▼           │
                              Browser app (React + StylesUI + markdown-it)
                                /document/<repo-relative path>
```

### Units

Each unit has one purpose and a narrow interface, so it can be tested on its own.

| Unit | Purpose | Depends on |
|---|---|---|
| `cli` | Parses commands, finds or starts the server under a lock, calls the HTTP API with the server token, formats agent-facing output | server HTTP API |
| `server` | Hono app: routes, host, origin and token checks, SSE, poll waiting | store, anchorer, watcher, events |
| `store` | Validated read and atomic write of `.markdown-review/` files; thread state transitions; review state; thread ID allocation; the "needs agent" query | file system, schemas |
| `blocks` | Turns markdown source into a list of blocks `{ startLine, endLine, text, lineOffsets, exactLines, wholeBlockOnly }` with canonical text (section 7); used by server and browser | markdown-config |
| `anchorer` | Given a doc's blocks and a passage anchor, returns the updated anchor (moved or outdated) | blocks, approx-string-match |
| `watcher` | Watches docs that are open in a browser or have threads; emits document-changed | chokidar |
| `events` | In-process event bus connecting watcher, store, poll waiters and SSE clients | none |
| `markdown-config` | The one markdown-it configuration, including the render rules that tag block elements (section 7), shared by server and browser | markdown-it, plugins |
| `web` | React app: document view, selection to draft, highlights, sidebar, navigation | server HTTP API, markdown-config, blocks, StylesUI |

Sharing `markdown-config` and `blocks` between server and browser lets both sides compute the same blocks and the same canonical text. Sharing alone does not guarantee the rendered DOM matches: section 7 lists the render rules this needs, and a conformance test (section 14) checks it.

### Root and server discovery

- For `open <path>`, the **root** is the git repository root of the doc, found with `git rev-parse --show-toplevel` run in the doc's directory. Every other command uses the git root of its current working directory. Outside a git repo, the root is the current working directory, and `open` rejects a doc outside it.
- In a git worktree, `--show-toplevel` returns the worktree's own root, so each worktree has its own store and server.
- There is **one server per root**. Once listening, it records itself in `.markdown-review/server.json`, written atomically with file mode 0600: `{ port, pid, version, protocol, root, token, startedAt }`.
  - `protocol` is an integer, bumped whenever the HTTP API or the storage format changes incompatibly. `version` is the package version and is informational.
  - `token` is a random secret generated at start-up, required on agent routes (section 13).
- The server listens on `127.0.0.1`. It first tries a preferred port derived from a hash of the root, in the range 49152-65535, and falls back to an OS-assigned port (listen on port 0) if that is taken. A restarted server therefore usually comes back on the same port, and an open tab's SSE connection reconnects.
- Every CLI command first reads `server.json` and calls `GET /api/health`:
  - Healthy, same root, same protocol: use it, whatever its package version.
  - File missing, process dead, health failing, or a different root: start a new server.
  - Older protocol: ask it to shut down (`POST /api/shutdown`), wait for the port to free, start the current version.
  - Newer protocol: leave it running and exit non-zero, with a `next_step` telling the agent to run the newer version.
- Starting a server happens under `.markdown-review/server.lock`, created exclusively and holding the CLI's pid. The CLI holding the lock re-checks health, starts the server detached with its output going to `.markdown-review/server.log`, waits for health, then removes the lock. A CLI that finds the lock waits for it to go, then re-checks health. A lock whose pid is dead is removed.
- The server shuts itself down after 30 minutes with no browser connected (SSE) and no poll waiting.

## 6. Storage and data model

### Layout

```
<root>/.markdown-review/
  .gitignore                     # "*" by default; written by the tool on first use
  server.json                    # runtime only
  server.lock                    # runtime only; present while a CLI starts the server
  server.log                     # runtime only; the detached server's output
  review.json                    # review state and threads with anchor kind "review"
  documents/
    docs/plans/plan.md.json      # threads for <root>/docs/plans/plan.md
```

By default `.markdown-review/.gitignore` contains `*`, so nothing in the store is committed. A user who wants review history in PRs replaces its contents with the three runtime files. Committing has a consequence the user accepts by opting in: every open thread in a committed store is delivered by `inbox` and `poll`, as a `user:` comment, to any agent in any clone.

### Types

```ts
type ThreadStatus = "draft" | "open" | "resolved";

interface Thread {
  id: number;
  status: ThreadStatus;
  anchor: Anchor;
  messages: Message[];
  draft?: DraftMessage;
  createdAt: string;
  updatedAt: string;
}

type Anchor = ReviewAnchor | DocumentAnchor | PassageAnchor;

interface ReviewAnchor {
  kind: "review";
}

interface DocumentAnchor {
  kind: "document";
  document: string;
}

interface PassageAnchor {
  kind: "passage";
  document: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  quote: string;
  anchoredText: string;
  prefix: string;
  suffix: string;
  outdated: boolean;
}

interface Message {
  author: "user" | "agent";
  body: string;
  at: string;
}

interface DraftMessage {
  body: string;
  at: string;
}
```

- `Thread.id` is shown as `#14`, and is unique per root (see Thread IDs below).
- `messages` holds submitted messages only, oldest first; `messages[0]` is the original comment. A draft thread has none.
- `draft` holds the user's unsubmitted text: on a draft thread it is the comment itself, otherwise a reply. A thread has at most one.
- `document` is a repo-relative POSIX path.
- `startLine` and `endLine` are 1-based and inclusive: the source lines containing the anchored text, exact to the line in all but the case section 7 describes, where the range is wider but still contains the text.
- `startOffset` and `endOffset` are offsets into the doc's canonical text (section 7); the end is exclusive.
- `quote` is the canonical text the user selected (or the whole block's text). It never changes.
- `anchoredText` is the canonical text the anchor covers now. It equals `quote` until an edit moves or changes the passage. Re-anchoring matches against it, so an anchor can follow its passage through several rounds of edits.
- `prefix` and `suffix` are up to 32 characters of canonical text either side of `anchoredText`, refreshed on every re-anchor.
- All timestamps are ISO 8601 strings. A message's `at` is when it was submitted, not when its draft was written, so messages stay in the order they reached the other side.

Each per-doc file is a `DocumentThreadsFile` and `review.json` is a `ReviewFile`. All files are validated with zod schemas on read.

```ts
interface DocumentThreadsFile {
  version: 1;
  document: string;
  sourceHash: string | null;
  threads: Thread[];
}

interface ReviewFile {
  version: 1;
  requestedAt: string | null;
  approvedAt: string | null;
  threads: Thread[];
}
```

- `sourceHash` is the SHA-256 of the doc source that the passage anchors were last computed against, or null while the doc is missing, so a restored doc is always re-anchored.
- `requestedAt` is set by every `open` and marks the start of a review round.
- `approvedAt` is set when the user approves and cleared when they request changes. The review is **approved** when `approvedAt` is later than `requestedAt`, so an approval from an earlier round never ends a later one.

### Thread IDs

The server allocates the highest existing ID plus one, scanning every store file when it starts. If two branches each created a thread with the same ID and were then merged, the server keeps the ID on the earlier-created thread, renumbers the other to the next free ID when it loads the files, and logs the change.

### State transitions

| Event | Effect |
|---|---|
| Agent runs `open` | Sets `requestedAt` |
| User creates a comment | New thread, `status: "draft"`, no messages, `draft` holds the text |
| User edits or deletes a draft | Changes or removes `draft`; removing a draft thread's `draft` deletes the thread |
| User writes a reply to an open or resolved thread | Sets the thread's `draft`; status unchanged until submit |
| User submits, requesting changes | For every thread with a `draft`: append it as a user message stamped with the submit time, and remove `draft`. Draft threads become `open`; resolved threads that received a message become `open`. Clear `approvedAt`. One write per affected file, then wake waiting polls. Disabled when there are no drafts. |
| User submits, approving | The same, except that `approvedAt` is set instead of cleared. Allowed with no drafts. |
| User resolves a thread | `status: "resolved"`, no message. A pending `draft` reply is kept, and submitting it reopens the thread. |
| Agent replies | Appends an agent message. Status unchanged, so a reply to a resolved thread leaves it resolved. |
| Agent resolves | Optional agent message, then `status: "resolved"`. Resolving a resolved thread only appends the message. |

A submit is not atomic across files. If the server stops part-way through, the files not yet written keep their drafts, and the user submits again.

**Needs agent:** a thread needs the agent when `status === "open"` and its last message has `author === "user"`. `inbox` and `poll` return exactly these threads, together with whether the review is approved. Draft threads and draft replies are never visible to the agent. Agent routes act on any thread that is not a draft, so the agent can resolve a thread it has already replied to.

## 7. Anchoring

### Blocks and line numbers

markdown-it block tokens carry `map: [line_begin, line_end]` with a 0-based start and exclusive end. Verified against markdown-it 15.0.2: for source `"# Title\n\nPara one\nline two\n..."`, the heading is `[0,1]` and the two-line paragraph is `[2,4]`. Stored and displayed line numbers are 1-based and inclusive, so the paragraph is lines 3-4.

Known quirk (verified): a non-final list item's map can include the trailing blank line, for example `[6,8]` for a one-line item. `blocks` trims trailing blank lines from each block's range.

`blocks` produces, in document order, one entry per leaf block (paragraph, heading, list-item paragraph, table row, fence/code block, html block, blockquote paragraph): `{ startLine, endLine, text, lineOffsets, exactLines, wholeBlockOnly }`. Tables are mapped per row because, in markdown-it 15.0.2, `tr_open` tokens carry a map but `th_open`/`td_open` and their inline tokens do not (verified).

### Canonical text

Server and browser work in one plain-text model of the doc, computed by `blocks` from markdown-it tokens, never from the DOM:

- A block's `text` is its inline content as it renders: text and code spans as written (with entities decoded, as markdown-it does), softbreaks and hardbreaks as `\n`, link text without the URL. Images contribute nothing, because alt text is an attribute and not page text. A table row's text is its cells joined with `\t`. A fence or code block's text is its code without the final newline.
- HTML blocks and Mermaid fences accept whole-block comments only. Their `text` is their source, used only for re-anchoring.
- `lineOffsets` gives, for each source line that contributes text, its 1-based line number and the offset in `text` where that line's text starts. Any offset therefore maps to an exact source line: one line per softbreak in a paragraph, one per code line in a fence, one per table row.
- A line break inside a code span, an HTML tag or an image leaves no trace in the tokens, so offsets after it would map one line too early. Such a block has `exactLines: false`, and a range whose last character is in it runs to the block's last line, so the reported range always contains the text.
- `wholeBlockOnly` is true for HTML blocks and Mermaid fences. It is also true for a block with no visible text, such as an image on its own or an empty fence, whose `text` is then its source so a whole-block comment has something to quote. And it is true for a paragraph or heading holding inline HTML other than phrasing elements (for example `<div>` or `<script>`), because the browser may move part of it out of the block or the sanitizer may remove it, so the rendered text can differ from the canonical text.
- The doc's canonical text is its blocks' texts joined with `\n`. Anchor offsets, `prefix` and `suffix` are positions and slices in this text.

### Rendering blocks to the DOM

The render rules in `markdown-config` give each block element a `data-md-block` attribute holding the block's index in `blocks`, plus `data-md-start` and `data-md-end`. markdown-it's default rendering needs three overrides (each verified against markdown-it 15.0.2):

- Paragraphs in tight lists are `hidden`, so markdown-it renders no `<p>` and drops their attributes. The rules wrap their inline content in a `<span>` that carries them. The enclosing `<li>` is never a block, because its map spans nested lists and the trailing blank line.
- A `highlight` function whose output starts with `<pre` (as Shiki's does) makes markdown-it drop the fence token's attributes. A custom fence rule wraps the highlighted output in an element that carries them.
- `html_block` tokens have no element of their own. The rules wrap each in a `<div>`, so an HTML construct split across several markdown blocks can render differently than on GitHub.

The browser reads a block's canonical text by walking the block element's text nodes in document order. In a table row it reads each cell and joins the cells with `\t`; everywhere else it reads every text node. Elements the app adds inside the document view (the gutter "+", numbered markers, the "Comment on this doc" link) carry `data-md-ignore` and `user-select: none`, and the walk skips them. Task-list checkboxes are `<input>` elements and contribute no text.

### Creating a passage anchor (browser)

1. On selection, map each end of the selection (DOM node and offset) through the walk to a block index and an offset in that block's text, then to an offset in the doc's canonical text. An end outside every block snaps to the nearest block edge.
2. `quote` is the canonical text between the two offsets; `prefix` and `suffix` are up to 32 characters either side. The line range comes from `lineOffsets`.
3. A whole-block comment (gutter "+") uses the block's whole text.
4. The create request sends the offsets, `quote`, `prefix`, `suffix` and the hash of the doc source the browser rendered. If the hash matches the server's current source, the server takes the offsets as given; otherwise it re-anchors the new draft against the current source straight away.

### When re-anchoring runs

Re-anchoring is driven by the source hash, not by the watcher:

- Whenever the server reads a doc's threads (for `inbox`, `poll` or the browser), it hashes the doc on disk. If the hash differs from the threads file's `sourceHash`, it re-anchors that doc's passage threads, then writes the threads and the new hash in one write.
- The watcher runs the same check when it sees a change, so open browsers get `document-changed` and `threads-changed` promptly. A missed watcher event, or an edit made while the server is stopped, only delays the push; the next read corrects the anchors.

### Re-anchoring algorithm

For each passage thread of the changed doc, including outdated and resolved ones, in order:

1. **Exact:** search the doc's canonical text for `anchoredText`. If it occurs once, use it. If several times, choose the occurrence whose surrounding text best matches `prefix` and `suffix`, then the one nearest the old offset.
2. **Approximate:** use `approx-string-match` (Myers bit-parallel; verified with a 97-character quote matched at 10 errors, so not limited to 32-character patterns) with `maxErrors = floor(0.2 * anchoredText.length)`. Choose by fewest errors, then context match, then nearest to the old offset.
3. **Outdated:** no match. Set `outdated: true`, and keep the last known lines and offsets (clamped to the doc's length), `quote` and `anchoredText`.

On a match, update the offsets, the lines (from `lineOffsets`), `anchoredText` (to the matched text), `prefix` and `suffix`, and set `outdated` to `false`. An outdated thread whose text reappears is therefore restored.

Matching against `anchoredText` rather than the original `quote` lets an anchor follow its passage through successive edits, each within the 20% budget. The trade-off is that a long run of small edits can carry an anchor onto text the user no longer recognises; the sidebar and the CLI show the original `quote` whenever it differs from `anchoredText`.

If the doc no longer exists, its passage threads are marked outdated and its doc threads are shown under the "doc not found" state in the UI.

`diff-match-patch` was considered and rejected: its matcher limits patterns to 32 characters (`Match_MaxBits = 32` in v1.0.5).

## 8. Agent interface (CLI)

### Commands

| Command | Behavior |
|---|---|
| `markdown-review open [path]` | Ensure the server and set `requestedAt`, starting a review round. If a browser tab is connected, tell the most recently connected one to show the doc (SSE `navigate`); otherwise open the browser at `/document/<path>`, or at the docs list if no path. Prints the URL. |
| `markdown-review inbox [--document <path>]` | Print whether the review is approved and the threads that need the agent; return immediately. |
| `markdown-review poll [--document <path>] [--timeout <seconds>]` | If the review is approved or any threads need the agent, print them and return immediately. Otherwise wait until the next submit (threads filtered by `--document` if given) or until the timeout, then print. |
| `markdown-review reply <id> <text>` | Add an agent message; status unchanged. `--file <path>` or `--file -` (stdin) for multi-line bodies. |
| `markdown-review resolve <id> [text]` | Optional agent message, then resolve. Same `--file` option. |
| `markdown-review stop` | Shut down the server for the current root. |
| `markdown-review install-skill [--global]` | Write `SKILL.md` to `<root>/.claude/skills/markdown-review/SKILL.md`, or to `~/.claude/skills/markdown-review/SKILL.md` with `--global`. |

Unknown thread IDs, including the IDs of draft threads, fail with a non-zero exit and list the valid IDs that need the agent.

### Poll semantics

- Polling never removes or marks anything. A thread leaves the agent's view only when the agent replies or resolves. Killing and re-running `poll` is always safe; several agents polling see the same threads.
- Approval is review-wide. Once the review is approved, every `poll` returns at once, with or without `--document`, until the next `open` starts a new round.
- Server side, a poll request waits on the event bus for a submit event; it writes a space every 15 seconds as a keep-alive while waiting. When the CLI disconnects, the server drops the waiter and updates presence.
- The CLI writes a one-line "waiting for review comments" banner to stderr so the agent does not think it hung. On SIGINT or SIGTERM it prints re-run guidance to stderr before exiting.

### Shell-tool time limits

Harnesses kill long-running shell commands. Verified limits:

- **Claude Code:** foreground Bash commands default to 2 minutes and allow up to 10 minutes (`timeout` up to 600000 ms). `run_in_background` runs a command detached for up to 30 minutes by default and 2 hours at most (`timeout` up to 7200000 ms), and re-invokes the agent when it exits (from the Bash tool's own description, 2026-10-08).
- **OpenCode:** the shell tool defaults to 2 minutes; the agent may pass a larger `timeout` in milliseconds with no maximum enforced (`packages/opencode/src/tool/shell.ts` on the `dev` branch, commit `5d9cd9b`). The default can be changed with `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS`. The shell tool has no background mode.

Design:

- `poll` defaults to `--timeout 540` (9 minutes), which fits under Claude Code's 10-minute foreground limit.
- `SKILL.md` and `poll`'s `next_step` tell the agent to run `poll` with a shell-tool timeout of at least 600000 ms. In Claude Code they recommend `run_in_background` with `--timeout 7080` and a Bash `timeout` of 7200000 ms, so a quiet review wakes the agent every two hours rather than every nine minutes. A submit still ends the poll at once.
- On timeout, `poll` exits 0 with "No comments yet" and a `next_step` to run it again.

### Output format

Plain compact text designed for agents, grouped by doc, ending in a `next_step` line. Examples:

```
2 threads need you (docs/plans/plan.md: 1, review: 1)

#14 docs/plans/plan.md:12-13
  quote: "cache results for 24h"
  user: Why 24h? Upstream data changes hourly.

#15 (whole review)
  user: The spec and plan disagree on the retry policy.

next_step: Edit the docs, then run `markdown-review resolve <id> "<what changed>"` for #14 and #15,
or `markdown-review reply <id> "<question>"` if you need input.
Then run `markdown-review poll` to wait for the next round.
```

```
Review approved. No threads need you.

next_step: The user approved the review. Carry on with your task; do not run `markdown-review poll`
again for this review.
```

```
Review approved, 1 thread needs you (docs/plans/plan.md: 1)

#16 docs/plans/plan.md:40
  quote: "retry three times"
  user: Nit: make the retry count configurable.

next_step: The user approved the review with comments. Address #16 and run `markdown-review resolve 16 "<what changed>"`,
then carry on with your task; do not run `markdown-review poll` again for this review.
```

- Reopened threads print their full history (`user:` / `agent:` lines in order).
- `quote:` is the text the anchor covers now (`anchoredText`). When it differs from what the user selected, the original follows on a `was:` line.
- Quotes longer than 200 characters print their start and end with `…` between; the line range is exact.
- Outdated passages print `(outdated)` after the location, with the original quote and last known lines.
- Doc-level threads print `#N docs/x.md (whole doc)`.
- `next_step` names the thread IDs that still need the agent, so after each `resolve` the agent sees what is left.
- Every command, including errors, ends with `next_step`.

### Teaching the agent

- `skills/markdown-review/SKILL.md` in Agent Skills format: a short description of when to use the tool, the review loop, what approval means, the time-limit guidance above, and a pointer to `markdown-review --help`.
- `install-skill` copies it into place. One location serves both harnesses: Claude Code reads project skills from `.claude/skills/<name>/SKILL.md` and personal skills from `~/.claude/skills/<name>/SKILL.md`, and OpenCode reads both of those as its "Claude-compatible" locations (both verified in the harnesses' docs, 2026-10-08).
- `SKILL.md` calls the bare `markdown-review` command and tells the agent to install the package globally if the command is missing. `npx` also works, but adds its start-up time to every `reply` and `resolve`.
- `--help` on every command.
- `next_step` in every output.

## 9. Server HTTP API

All routes are under `/api` except static assets, the app shell and repo files.

| Route | Caller | Purpose |
|---|---|---|
| `GET /api/health` | CLI | `{ name, version, protocol, root, pid }` |
| `POST /api/shutdown` | CLI | Graceful shutdown |
| `POST /api/agent/open` | CLI | `{ path? }`: set `requestedAt`; navigate a connected tab if there is one; return `{ url, navigated }` |
| `GET /api/documents` | browser | Docs with draft or open threads (with counts) plus recently opened docs |
| `GET /api/document?path=` | browser | `{ path, source, hash }`, or 404 with doc-missing |
| `GET /api/threads?document=` / `?all=1` | browser | `{ review: { requestedAt, approvedAt }, threads }`: threads for one doc plus review threads, or all threads |
| `POST /api/threads` | browser | Create a draft thread `{ anchor, body, renderedHash? }` |
| `PUT /api/threads/:id/draft` | browser | Write the thread's draft `{ body }`: creates a draft reply, or edits a draft comment or reply |
| `DELETE /api/threads/:id/draft` | browser | Delete the thread's draft (on a draft thread, deletes the thread) |
| `POST /api/threads/:id/resolve` | browser | User resolves |
| `POST /api/submit` | browser | Submit all drafts, with `verdict` of `"request-changes"` or `"approve"` |
| `GET /api/inbox?document=` | CLI | Approval state and threads needing the agent |
| `GET /api/poll?document=&timeout=` | CLI | Waiting variant of inbox |
| `POST /api/agent/threads/:id/reply` | CLI | Agent reply |
| `POST /api/agent/threads/:id/resolve` | CLI | Agent resolve |
| `GET /api/events` | browser | SSE stream (`hono/streaming` `streamSSE`): `document-changed`, `threads-changed`, `presence`, `navigate` |
| `GET /files/*` | browser | Raw repo files (images and other linked files), confined to root and sandboxed (section 13) |
| `GET /*` | browser | App shell (built React app) |

Presence is `{ agentWaiting: boolean }`: true while at least one poll request is open.

## 10. Browser UI

Layout: top bar, document view, fixed right sidebar, built from StylesUI components (for example `PageLayout`, `Sidebar`, `Prose`, `SegmentedControl` and `Popover`).

### Top bar

- Doc path (repo-relative).
- **Docs** menu: docs with open or draft threads, with counts, plus recently opened docs.
- Agent status: "Agent waiting" while a poll is open, otherwise "Agent not listening, comments will wait in the inbox".
- An "Approved" badge while the review is approved.
- **Submit (N)**, where N is the number of draft threads and draft replies across the whole repo. It offers **Request changes** (disabled when N is 0) and **Approve** (always available; submits any drafts too).

### Writing comments

- **Passage:** select text, including across blocks; a Comment button appears next to the selection; clicking it opens a draft in the sidebar with focus in it.
- **Block:** hovering a block shows a "+" in the left gutter; the whole block becomes the quote. Used for code blocks, tables, diagrams and HTML blocks.
- **Doc:** "Comment on this doc" link under the doc's first heading.
- **Review:** "Comment on review" box at the top of the sidebar.

### Highlights

- Highlights use the CSS Custom Highlight API over DOM ranges built from anchor offsets through the walk in section 7, so the rendered HTML is never modified after insertion.
- Clicking highlighted text maps the click point to a doc offset and selects the thread whose range contains it. Numbered markers in the gutter are buttons that do the same.
- The click mapping uses `document.caretPositionFromPoint`, falling back to `document.caretRangeFromPoint` where it is missing (Safari before 26.2).

### Supported browsers

Current versions of Chrome, Firefox and Safari. The CSS Custom Highlight API sets the floor: Chrome 105, Firefox 140, Safari 17.2 (MDN browser-compat-data, 2026-10-08).

### Sidebar

- Groups: Drafts, Open, Outdated, Resolved (Resolved collapsed by default).
- **This doc / All docs** toggle. All docs lists every thread grouped by doc; this is how the user reviews the set as a whole.
- Clicking a thread scrolls to its passage (navigating to its doc if needed) and highlights it; clicking a highlight or numbered marker selects its thread.
- Each thread shows its messages, a reply box (creates a draft reply), and a Resolve action.
- A passage thread whose `anchoredText` differs from its `quote` shows both.
- New agent messages since the user last viewed the thread show a "new" marker.

### Navigation

- Relative links to `.md` files inside the root navigate in-app (`/document/<path>`).
- `#heading` links scroll within the doc; headings get GitHub-style slug IDs.
- Other relative links resolve to `/files/<path>`; external links open in a new tab.
- A `navigate` event from `open` moves the tab to the requested doc.

### Live updates

- On `document-changed`, re-fetch the doc and re-render in place, preserving scroll position and any unsent draft text in the sidebar.
- On `threads-changed`, re-fetch threads; highlights and markers follow the server's re-anchored ranges.
- When the SSE connection drops, the app retries. A server restarted on the same port is picked up and everything is re-fetched. If it cannot reconnect, the app says the server has stopped and that `markdown-review open` restarts it.

## 11. Rendering

- Shared `markdown-config`: markdown-it with tables and strikethrough (built in), task lists via `@mdit/plugin-tasklist`, and the block render rules from section 7.
- Syntax highlighting with Shiki, loading only the grammars for languages the doc uses. markdown-it renders synchronously, so those grammars load before rendering, which makes rendering a doc async.
- Mermaid fences rendered with `mermaid`, loaded only when a doc contains a Mermaid fence. Diagrams accept whole-block comments only.
- Raw HTML in markdown is allowed (`html: true`) and the rendered output is sanitized with DOMPurify before insertion. HTML blocks accept whole-block comments only.
- Front matter, footnotes and math are rendered as plain markdown would render them; no special support.

## 12. Error handling

| Situation | Behavior |
|---|---|
| Server not running, stale `server.json`, dead pid | CLI starts a new server and continues |
| Two CLI commands start a server at the same time | The lock serializes start-up; the second command uses the first one's server |
| Server speaks an older protocol | CLI asks it to shut down, then starts the current version |
| Server speaks a newer protocol | CLI leaves it running and exits non-zero, with a `next_step` to run the newer version |
| Server restarts while a tab is open | Tab reconnects if the server is back on the same port; otherwise it says how to restart |
| Doc edited while the server is stopped, or before the watcher fires | The next read sees the hash change and re-anchors before answering |
| Corrupt or invalid `.markdown-review/` file | Server reports the file and error to CLI and browser; refuses to write that file; never overwrites it |
| Concurrent writes | Only the server writes; all writes are serialized by an in-process mutex and written to a temp file then renamed |
| Server stops part-way through a submit | Files not yet written keep their drafts; the user submits again |
| Duplicate thread IDs after a merge | The later-created thread is renumbered on load and the change is logged |
| Doc deleted or renamed | Doc view shows "doc not found" with its threads; threads marked outdated |
| Unknown thread ID from the agent | Non-zero exit, list of valid IDs needing the agent |
| Agent tries to act on a draft | Impossible: drafts are invisible to agent routes, which return unknown-ID |
| Poll killed by the harness | Nothing lost; re-run guidance printed on SIGINT/SIGTERM |
| Doc path outside root | 403 |

## 13. Security

Comments are instructions to an agent that has a shell, so the comment channel is protected as well as the files.

- Listen on `127.0.0.1` only.
- Check the `Host` header on every request against `127.0.0.1:<port>` and `localhost:<port>` (blocks DNS rebinding).
- Browser routes (mutations) require an `Origin` header equal to the server's own origin.
- Agent routes (`/api/agent/*`, `/api/poll`, `/api/inbox`, `/api/shutdown`) require `Authorization: Bearer <token>` with the token from `server.json`, and reject any request that carries an `Origin` header. A web page cannot read `server.json`, so it cannot act as the agent, including through a no-cors GET, which browsers send without an `Origin` header. Because `server.json` has file mode 0600, other local users are kept out too.
- File serving resolves real paths and rejects anything outside the root, including via `..` or symlinks. Every `/files/*` response carries `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`, so a linked `.html` or `.svg` file cannot run script on the server's origin, where it could otherwise post comments.
- The app shell is served with a Content Security Policy that allows scripts only from its own origin.
- Rendered HTML is sanitized with DOMPurify.
- The store is git-ignored by default (section 6), because open threads in a committed store reach the agent in every clone.

## 14. Testing

Vitest runs as projects, as in pull-request-assistant: a `node` project for `src/cli`, `src/server` and `src/shared` (Node environment, `TZ=UTC`), and a `web` project for `src/web` (jsdom). `pnpm verify` runs lint, format check, typecheck and tests.

- **Unit (Vitest, `node` project):**
  - `blocks`: line ranges for each block type, including the list-item trailing-blank-line quirk; canonical text and `lineOffsets` for each block type; exact lines inside multi-line paragraphs and fences.
  - `anchorer`: moved exactly, duplicate text resolved by context, approximate match, an anchor followed through successive edits, outdated, outdated then restored, doc deleted.
  - `store`: atomic writes, schema validation failures, every state transition in section 6 (including a draft reply written before an agent reply and submitted after it), approval across review rounds, the needs-agent query, ID allocation and renumbering after a merge.
  - CLI output formatting for each thread shape and each approval state.
- **Conformance (Vitest, `web` project):** render a fixture corpus with `markdown-config` (including tight and loose lists, nested lists, tables, fences highlighted by Shiki, HTML blocks, task lists and entities) and check, for every entry in `blocks`, that exactly one element carries its index and line range and that the text walk of that element equals the block's `text`.
- **Integration (Vitest, real server on a temp git repo, driven through the CLI):** poll returns on submit; poll timeout exits cleanly; kill and re-run returns the same threads; approval ends a poll and a new `open` starts a new round; a doc edited while the server is stopped is re-anchored on the next `inbox`; protocol mismatch in both directions; concurrent CLI commands start one server; one server per root; host, origin and token checks; `/files/*` security headers.
- **Component (Vitest + Testing Library, `web` project):** sidebar grouping, This doc / All docs toggle, draft create/edit/delete, Submit count, Request changes and Approve.
- **End-to-end (Playwright):** select text, draft, submit; `poll` returns the comment; agent edits the file and the highlight follows the text; `resolve` moves the thread to Resolved; Approve ends the agent's poll; a relative link opens the linked doc.

## 15. Tech stack

The toolchain matches the StylesUI and pull-request-assistant repos. Versions are the latest published on npm on 2026-10-08 and are recorded for reference. Dependencies are installed with `pnpm add` and no hand-written version, and the lockfile pins them.

| Area | Choice | Version seen |
|---|---|---|
| Package manager | pnpm, set in `packageManager` as in the reference repos | 10.18.3 in the reference repos (12.10.1 on npm) |
| Language | TypeScript, type-checked with `tsc -b` over project references | 7.0.2 |
| Lint | `oxlint` with the `react`, `typescript`, `oxc` and `jsx-a11y` plugins and the reference repos' rule set | 1.87.0 |
| Format | `oxfmt`: print width 120, 2-space indent, semicolons, double quotes, `es5` trailing commas | 0.72.0 |
| Git hooks | `husky` + `lint-staged` (`oxlint --fix`, then `oxfmt`); `fallow audit` in pre-commit when installed, as in StylesUI | 9.1.7 / 17.6.0 |
| Server | `hono` + `@hono/node-server` | 4.13.13 / 2.1.4 |
| Markdown | `markdown-it` + `@mdit/plugin-tasklist` | 15.0.2 / 1.1.3 |
| Fuzzy matching | `approx-string-match` | 2.0.0 |
| Validation | `zod` | 4.6.5 |
| File watching | `chokidar` | 5.0.0 |
| Open browser | `open` | 11.0.4 |
| UI | `react` + `react-dom`, with the React Compiler (`babel-plugin-react-compiler` through `@rolldown/plugin-babel`) | 19.3.0 / 1.0.0 / 0.2.4 |
| Components | `@krelborn/stylesui` | 0.2.0-beta.3 (from its repo) |
| Build | `vite` + `@vitejs/plugin-react` | 8.3.3 / 6.1.2 |
| Highlighting | `shiki` | 4.5.0 |
| Diagrams | `mermaid` | 12.1.0 |
| Sanitizing | `dompurify` | 3.4.16 |
| Unit and component tests | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` | 5.0.3 / 30.1.2 / 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 |
| End-to-end tests | `@playwright/test` | 1.64.0 |

- **Node.js:** `engines` as in pull-request-assistant, `^22.22.2 || ^24.15.0 || >=26.0.0`.
- **TypeScript settings,** as in pull-request-assistant: `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `moduleDetection: "force"`, target ES2023. There are separate configs for Node code (`src/cli`, `src/server`, `src/shared`), the web app (`src/web`, `src/shared`, with DOM libs, `vite/client` types and `react-jsx`), and the tool config files.

### Packaging

- One npm package containing the CLI, the server and the built web app, with a `bin` entry `markdown-review`, runnable via `npx`. It is published as `@krelborn/markdown-review` to the public npm registry, because `npx` from GitHub Packages needs a token. Scoped packages are private by default, so `publishConfig` sets `access: "public"` and the npmjs.com registry. The development `.npmrc` maps the whole `@krelborn` scope to GitHub Packages, so a `pnpm publish --dry-run` must confirm the target registry before the first publish.
- StylesUI is published to GitHub Packages, so it is a devDependency that Vite bundles into the built web app; users of the package never install it. Development needs an `.npmrc` mapping the `@krelborn` scope to GitHub Packages with `GITHUB_TOKEN`, as in pull-request-assistant.
- The CLI and server ship as built ESM JavaScript, because Node does not strip types from files under `node_modules`.

## 16. Project setup

Before the first implementation task, the repo gets the reference repos' scaffolding:

- `git init`, with `origin` set to the existing GitHub repo `Krelborn/markdown-review` (private for now), and a `.gitignore` (`node_modules/`, `dist/`, `coverage/`, `*.log`, `*.tsbuildinfo`, `.DS_Store`, `.superpowers/`).
- An MIT `LICENSE`, with `"license": "MIT"` and the `repository` field in `package.json`. The npm page's source link only works for others once the repo is made public.
- `.claude/settings.json` enabling `coding-standards@krelborn-standards` from the `Krelborn/agent-coding-standards` marketplace, so the TypeScript, React, comments and Vitest standards load while working. They are authoritative over any code in this spec or the plan.
- `CLAUDE.md` in pull-request-assistant's shape: a summary with links to this spec and the plan, commands, layout, the coding standards note, and "install dependencies with `pnpm add` and no hand-written version".
- `package.json` scripts as in the reference repos (`lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `verify`, `prepare`), plus `build` and `test:e2e`.
- `.oxlintrc.json`, `.oxfmtrc.json`, `.lintstagedrc.json` and `.husky/pre-commit` following the reference repos, and a `.fallowrc.json` with this repo's entry points.
- A GitHub Actions CI workflow following StylesUI's: install with a frozen lockfile, install Playwright browsers, then lint, format check, typecheck, test and build.
- Source layout: `src/cli/`, `src/server/` (including the anchorer), `src/shared/` (`markdown-config`, `blocks` and the zod schemas, used by both sides), `src/web/`, and `skills/markdown-review/SKILL.md`.

## 17. Implementation plans

The work is split into three plans, carried out in order. Each ends with working, tested software.

1. **Foundations:** the project setup in section 16, then the shared core: `markdown-config` with the block render rules, `blocks` with canonical text and `lineOffsets`, the conformance test, the zod schemas, `store` and `anchorer`. The riskiest seam, canonical text, is settled first.
2. **Server and CLI:** `server`, `watcher`, `events` and `cli`, giving the whole agent loop (`open`, `inbox`, `poll`, `reply`, `resolve`, `stop`), covered by integration tests that create comments through the browser API without a UI.
3. **Web app and skill:** the React app, `SKILL.md` and `install-skill`, component tests and the end-to-end tests.

## 18. Risks and open items

- **npm name taken:** `markdown-review` is already published on npm (v0.0.9, "Interactive markdown plan review UI", github.com/rwoll/markdown-review). Publish as `@krelborn/markdown-review` while keeping the `markdown-review` bin name. The author owns the `krelborn` npm user, and npm grants every user the scope matching its name. That package was reviewed as prior art: it is a one-shot, single-file review whose server exits on submit and prints feedback to stdout, with question blocks the agent embeds in the doc. It has no persistent threads, repo-wide review or re-anchoring.
- **Canonical text conformance:** the walk in section 7 must reproduce `blocks` text exactly, and a change in markdown-it, Shiki or DOMPurify output can break it. The conformance test guards this and must pass on every upgrade of those packages.
- **Agents not following time-limit guidance:** if an agent runs `poll` with a 2-minute shell timeout, the poll is killed; nothing is lost, but the agent may loop. The SIGTERM guidance and `next_step` mitigate this; real-world behavior should be checked with both Claude Code and OpenCode during implementation.
- **Quote text vs source text:** quotes are canonical rendered text, not markdown source, so the agent sees `"cache results for 24h"` where the source may contain `**24h**`. The line range, exact to the line, is the agent's precise locator; the quote is for human context and re-anchoring.
- **Anchor drift:** following `anchoredText` through many small edits can move an anchor onto text the user no longer recognises (section 7). Showing the original `quote` alongside makes this visible rather than preventing it.
- **Post-MVP:** human editing in the browser (likely a source editor first), SessionStart hooks, export of review history, agent-embedded question blocks (as in the prior art), Windows support.
