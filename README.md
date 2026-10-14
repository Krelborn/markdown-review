<p align="center">
  <img src="https://raw.githubusercontent.com/Krelborn/markdown-review/main/docs/images/icon.svg" width="96" height="96" alt="">
</p>

<h1 align="center">Markdown Review</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@krelborn/markdown-review"><img src="https://img.shields.io/npm/v/@krelborn/markdown-review" alt="npm version"></a>
  <a href="https://github.com/Krelborn/markdown-review/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Krelborn/markdown-review/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/@krelborn/markdown-review"><img src="https://img.shields.io/npm/dm/@krelborn/markdown-review" alt="npm downloads per month"></a>
  <a href="#requirements"><img src="https://img.shields.io/node/v/@krelborn/markdown-review" alt="Node.js versions"></a>
  <a href="https://github.com/Krelborn/markdown-review/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@krelborn/markdown-review" alt="MIT licence"></a>
</p>

Review the markdown your coding agent writes, such as plans, specs and design notes, in your browser, the way you would review a pull request. Then hand your comments back to the agent so it can edit the docs and answer each one.

The website has a tour and the docs: [krelborn.github.io/markdown-review](https://krelborn.github.io/markdown-review/).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Krelborn/markdown-review/main/docs/images/review-dark.png">
  <img src="https://raw.githubusercontent.com/Krelborn/markdown-review/main/docs/images/review-light.png" alt="A plan open in Markdown Review. The doc is on the left with two passages highlighted, and the comments column on the right holds a draft comment, an open thread in which the agent asks a question, and resolved threads.">
</picture>

Markdown Review runs locally on your machine. It is a CLI that starts a small server for each repository and serves a browser app on `127.0.0.1`. The agent talks to it through ordinary shell commands, so it works with Claude Code, Codex, OpenCode or any agent that has a shell tool. No MCP server or plugin needed.

> [!WARNING]
> Markdown Review is in beta. It works, but expect rough edges, and expect commands and behaviour to change between releases until 1.0.

## Requirements

- Node.js 22.22.2 or later in the 22 line, 24.15.0 or later in the 24 line, or 26 and later
- macOS or Linux
- A current version of Chrome, Firefox or Safari (at least Chrome 123, Firefox 140 or Safari 17.5)

The tool works best inside a git repository, where the repository root is the scope of the review. Outside one, it uses the current directory.

## Install

A global install is recommended:

```sh
npm install --global @krelborn/markdown-review
```

Or run it without installing, with `npx @krelborn/markdown-review <command>`.

Then teach your agent the review loop by installing the skill:

```sh
markdown-review install-skill            # into this repository's .claude/skills and .agents/skills
markdown-review install-skill --global   # into ~/.claude/skills and ~/.agents/skills, for every repository
```

Claude Code reads `.claude/skills`; Codex, Gemini CLI and most other agents read `.agents/skills`. Agents that read both, such as OpenCode, Cursor and GitHub Copilot, find the skill in each. To write just one copy, add `--only claude` or `--only agents`. The skill loads when an agent session starts, so start a new session after installing it.

## Usage

### Ask your agent for a review

With the skill installed, ask in plain words, for example "I'd like to review the plan in markdown-review". The agent opens the doc, waits for your comments, edits the doc, answers each comment and waits again, until you say go ahead.

You can also start a review yourself, then tell the agent to pick up the comments:

```sh
markdown-review open docs/plan.md
```

`open` with no path shows the list of docs in the repository.

### Review in the browser

- **Comment on a passage:** select text, including across paragraphs, and click **Comment**.
- **Comment on blocks:** hover over a block and click the **+** in the left margin, or drag down the margin to take in several blocks. Use this for code blocks, diagrams and HTML.
- **Comment on a table, list or section:** click the bracket at the far left of the margin, or ⌥-click (Alt-click) the margin.
- **Comment on a doc or on the whole review:** click **+ Comment** at the top of the comments and choose **On this doc** or **On the whole review**.

Comments are saved as drafts until you submit them. Click **Edit** to change one, or **Discard** to throw one away; it asks first. When you are ready to hand over to your agent, click **Submit**. Choose:

- **Revise**, to send your drafts to the agent and wait for its answers.
- **Go ahead**, to end the review and let the agent carry on with its task. Any drafts are sent too, and the agent addresses them first.
- **Hand back to agent**, to end the review and have the agent stop and wait for you in the chat. Any drafts are sent too, and the agent tells you what they say. Use it when the direction is wrong, you want to talk it over, or you will take it from here.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Krelborn/markdown-review/main/docs/images/submit-dark.png">
    <img src="https://raw.githubusercontent.com/Krelborn/markdown-review/main/docs/images/submit-light.png" width="384" alt="The Submit review popover for one draft, offering Revise, Go ahead with the agent's next task, or Hand back to agent, and saying the agent is listening and will hear at once.">
  </picture>
</p>

The comments are grouped into Drafts, Open, Outdated and Resolved. When other docs have comments too, **This doc** and **All docs** tabs at the top switch between this doc's comments and every doc's, so you can review a set of docs together. Click a thread's location to jump to its passage, or click highlighted text to find its thread.

Reply to a resolved thread to reopen it. Resolved stays folded until the agent answers in it, when it opens to show you. A thread becomes outdated when the agent's edits remove the text it was on.

Links between markdown docs in the repository open in the app. Docs render with GitHub-style tables, task lists, alerts, syntax-highlighted code and Mermaid diagrams. Frontmatter shows as a Properties panel at the top of the doc, and each heading has a link you can copy.

### Commands

These are the commands the agent runs. You rarely need them yourself, but they are handy for trying the tool out.

| Command                                                            | What it does                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown-review open [path] [--next-task <text>]`                 | Start a review round, or add the doc to the one in progress, and show the doc, or the docs list, in the browser. `--next-task` says what the agent will do once you say go ahead. Prints the URL. |
| `markdown-review poll [--document <path>] [--timeout <seconds>]`   | Wait until you submit, then print the comments that need the agent. Gives up after 540 seconds by default.                                                                                        |
| `markdown-review inbox [--document <path>]`                        | Print the same as `poll`, without waiting.                                                                                                                                                        |
| `markdown-review reply <id> <text>`                                | Answer a thread without resolving it, for example to ask you a question.                                                                                                                          |
| `markdown-review resolve <id> [text]`                              | Resolve a thread, optionally saying what changed.                                                                                                                                                 |
| `markdown-review stop`                                             | Stop the review server for this repository.                                                                                                                                                       |
| `markdown-review install-skill [--global] [--only claude\|agents]` | Install the skill that teaches agents this workflow in `.claude/skills` and `.agents/skills`, or with `--only` in just one of them.                                                               |

`reply` and `resolve` also take `--file <path>` for a long message, or `--file -` to read standard input. `markdown-review --help` lists the commands, and `markdown-review <command> --help` describes one. Every command ends with a `next_step` line that tells the agent what to do next.

Set `MARKDOWN_REVIEW_NO_BROWSER=1` to stop `open` from launching a browser.

### Updates

About once a day, the review server asks the npm registry for the latest version of `@krelborn/markdown-review`, and keeps the answer in `~/.cache/markdown-review/` (or under `$XDG_CACHE_HOME`). The request names only the package. When a newer version is out, the About button in the browser shows a dot, and `open` tells the agent, which offers to update once you say go ahead and only updates if you agree. The agent is also told when an installed copy of the skill is from an older version.

Set `MARKDOWN_REVIEW_NO_UPDATE_CHECK=1` or `NO_UPDATE_NOTIFIER` to turn the check off. It is also off when `CI` is set.

### Long waits

`poll` waits for a person, so it can outlast an agent's shell timeout. Give the shell command a timeout of at least 600000 ms. In Claude Code, run `markdown-review poll --timeout 7080` in the background with a Bash timeout of 7200000 ms; a submit still ends it at once. If `poll` stops before you submit, nothing is lost: the agent runs it again. The skill tells the agent all of this.

## How it works

1. Your agent writes a doc and runs `markdown-review open docs/plan.md`. The doc opens rendered in your browser.
2. You comment on passages, blocks, whole docs or the review as a whole, across as many linked docs as you like. Then you submit.
3. The agent, waiting in `markdown-review poll`, receives each comment with its file, line range, quoted text and your words.
4. The agent edits the docs and resolves or replies to each comment. Your browser re-renders the doc in place, and your comments follow the text they were made on.
5. You read the answers, reply to any thread to reopen it, and submit again. When you say go ahead, the agent carries on with its task. When you hand the review back, it stops and waits for you in the chat.

This is what the agent receives in step 3 for the review in the screenshot above:

```text
3 threads need you (docs/plans/rate-limiting.md: 3)

#1 docs/plans/rate-limiting.md:15
  quote: "stored in Redis so that every instance of the API shares the same count."
  user: What happens when Redis is down? I'd rather fail open than reject every request.

#2 docs/plans/rate-limiting.md:21
  quote: "Enterprise\t6000\t1000"
  user: Enterprise customers negotiate their own limits, so read these from the plan record instead of hard-coding them.

#3 docs/plans/rate-limiting.md (whole doc)
  user: Looks good overall. Add a section on how we'll know it's working once it's live.

next_step: Edit the docs, then run `markdown-review resolve <id> "<what changed>"` for #1, #2 and #3, or `markdown-review reply <id> "<question>"` if you need input. Then run `markdown-review poll` to wait for the next round.
```

## Where reviews are stored

Comments live in a `.markdown-review/` directory at the repository root, one JSON file per doc, alongside the server's runtime files. It contains a `.gitignore` of `*`, so nothing is committed by default.

To keep review history in git, replace that `.gitignore` with one listing only `server.json`, `server.lock` and `server.log`. Be aware that every open thread in a committed store reaches any agent that runs `inbox` or `poll` in any clone.

The server stops itself after 30 minutes with no browser connected, no `poll` waiting and no request, and the next command starts it again.

## Security

The server listens only on `127.0.0.1`. Agent commands need a random token that the server writes to `.markdown-review/server.json` with owner-only permissions, so a web page cannot post comments to your agent. Raw HTML in docs is sanitized before it is shown, and other files from the repository are served as plain content, never run as code.

## Build from source

Building from source needs read access to `@krelborn/stylesui`, a private package on GitHub Packages that the web app is built with. The npm package already includes it, so you don't need it to install or use Markdown Review. If you do want to build from source, [open an issue](https://github.com/Krelborn/markdown-review/issues) asking for access.

With access:

```sh
git clone https://github.com/Krelborn/markdown-review.git
cd markdown-review
GITHUB_TOKEN=$(gh auth token) pnpm install
pnpm build
npm link
```

The install reads a GitHub token with `read:packages` from `GITHUB_TOKEN`. `npm link` puts `markdown-review` on your `PATH`; you can also run `node <this repo>/dist/cli.js` directly.

## Feedback

Bug reports, questions and ideas are very welcome: please [open an issue](https://github.com/Krelborn/markdown-review/issues).

I'm not accepting pull requests. Markdown Review is a small project I maintain in my spare time, and for now I want to keep its design in one place. If you have a fix in mind, describe it in an issue and I'll take it from there.

## License

[MIT](https://github.com/Krelborn/markdown-review/blob/main/LICENSE)
