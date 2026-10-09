# Markdown Review

> [!WARNING]
> Markdown Review is in beta. It works, but expect rough edges, and expect commands and behaviour to change between releases until 1.0.

Review the markdown your coding agent writes, such as plans, specs and design notes, in your browser, the way you would review a pull request. Then hand your comments back to the agent so it can edit the docs and answer each one.

Markdown Review is a local tool. It is one CLI that starts a small server for each repository and serves a browser app on `127.0.0.1`. The agent talks to it through ordinary shell commands, so it works with Claude Code, OpenCode or any agent that has a shell tool. It needs no MCP server and no plugin.

## How it works

1. Your agent writes a doc and runs `markdown-review open docs/plan.md`. The doc opens rendered in your browser.
2. You comment on passages, blocks, whole docs or the review as a whole, across as many linked docs as you like. Then you submit.
3. The agent, waiting in `markdown-review poll`, receives each comment with its file, line range, quoted text and your words.
4. The agent edits the docs and resolves or replies to each comment. Your browser re-renders the doc in place, and your comments follow the text they were made on.
5. You read the answers, reply to any thread to reopen it, and submit again, until you approve the review. The agent then carries on with its task.

## Requirements

- Node.js 22.22.2 or later in the 22 line, 24.15.0 or later in the 24 line, or 26 and later
- macOS or Linux
- A current version of Chrome, Firefox or Safari (at least Chrome 105, Firefox 140 or Safari 17.2)

The tool works best inside a git repository, where the repository root is the scope of the review. Outside one, it uses the current directory.

## Install

Install the CLI globally:

```sh
npm install --global @krelborn/markdown-review
```

Or run it without installing, with `npx @krelborn/markdown-review <command>`.

Then teach your agent the review loop by installing the skill:

```sh
markdown-review install-skill            # into this repository's .claude/skills
markdown-review install-skill --global   # into ~/.claude/skills, for every repository
```

Claude Code and OpenCode both read skills from there. The skill loads when an agent session starts, so start a new session after installing it.

### Install from source

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

## Usage

### Ask your agent for a review

With the skill installed, ask in plain words, for example "have me review the plan in markdown-review". The agent opens the doc, waits for your comments, edits the doc, answers each comment and waits again, until you approve.

You can also start a review yourself, then tell the agent to pick up the comments:

```sh
markdown-review open docs/plan.md
```

`open` with no path shows the list of docs in the repository.

### Review in the browser

- **Comment on a passage:** select text, including across paragraphs, and click **Comment**.
- **Comment on a block:** hover over a block and click the **+** in the left margin. Use this for code blocks, tables, diagrams and HTML.
- **Comment on a doc or on the whole review:** click **+ Comment** at the top of the comments and choose **On this doc** or **On the whole review**.

You write one comment at a time. If you start another while the open one has text you haven't saved, it asks whether to save or discard that text first. Press Cmd+Enter (Ctrl+Enter on Windows and Linux) to save, and Escape to close.

Saved comments are drafts, marked with a Draft badge, until you submit them. Click **Edit** to change one. When you are ready, click **Submit** at the foot of the comments. It shows how many drafts it will send and which docs they are on. Choose:

- **Request changes**, to send your drafts to the agent and wait for its answers.
- **Approve**, to end the review. Any drafts are sent with the approval, and the agent addresses them before carrying on.

The comments are grouped into Drafts, Open, Outdated and Resolved. When other docs have comments too, **This doc** and **All docs** tabs at the top switch between this doc's comments and every doc's, so you can review a set of docs together. Click a thread's location to jump to its passage, or click highlighted text to find its thread. Reply to a resolved thread to reopen it. A thread becomes outdated when the agent's edits remove the text it was on.

The bar beneath the comments shows whether the agent is listening. If it is not, your comments wait in its inbox until it next looks; the **Submit** menu says which.

Links between markdown docs in the repository open in the app. Docs render with GitHub-style tables, task lists, syntax-highlighted code and Mermaid diagrams.

### Commands

These are the commands the agent runs. You rarely need them yourself, but they are handy for trying the tool out.

| Command                                                          | What it does                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `markdown-review open [path]`                                    | Start a review round and show the doc, or the docs list, in the browser. Prints the URL.                              |
| `markdown-review poll [--document <path>] [--timeout <seconds>]` | Wait until you submit or approve, then print the comments that need the agent. Gives up after 540 seconds by default. |
| `markdown-review inbox [--document <path>]`                      | Print the same as `poll`, without waiting.                                                                            |
| `markdown-review reply <id> <text>`                              | Answer a thread without resolving it, for example to ask you a question.                                              |
| `markdown-review resolve <id> [text]`                            | Resolve a thread, optionally saying what changed.                                                                     |
| `markdown-review stop`                                           | Stop the review server for this repository.                                                                           |
| `markdown-review install-skill [--global]`                       | Install the skill that teaches agents this workflow.                                                                  |

`reply` and `resolve` also take `--file <path>` for a long message, or `--file -` to read standard input. `markdown-review --help` lists the commands, and `markdown-review <command> --help` describes one. Every command ends with a `next_step` line that tells the agent what to do next.

Set `MARKDOWN_REVIEW_NO_BROWSER=1` to stop `open` from launching a browser.

### Long waits

`poll` waits for a person, so it can outlast an agent's shell timeout. Give the shell command a timeout of at least 600000 ms. In Claude Code, run `markdown-review poll --timeout 7080` in the background with a Bash timeout of 7200000 ms; a submit still ends it at once. If `poll` stops before you submit, nothing is lost: the agent runs it again. The skill tells the agent all of this.

## Where reviews are stored

Comments live in a `.markdown-review/` directory at the repository root, one JSON file per doc, alongside the server's runtime files. It contains a `.gitignore` of `*`, so nothing is committed by default.

To keep review history in git, replace that `.gitignore` with one listing only `server.json`, `server.lock` and `server.log`. Be aware that every open thread in a committed store reaches any agent that runs `inbox` or `poll` in any clone.

The server stops itself after 30 minutes with no browser connected, no `poll` waiting and no request, and the next command starts it again.

## Security

The server listens only on `127.0.0.1`. Agent commands need a random token that the server writes to `.markdown-review/server.json` with owner-only permissions, so a web page cannot post comments to your agent. Raw HTML in docs is sanitized before it is shown, and other files from the repository are served as plain content, never run as code.

## Feedback

Bug reports, questions and ideas are very welcome: please [open an issue](https://github.com/Krelborn/markdown-review/issues).

I'm not accepting pull requests. Markdown Review is a small project I maintain in my spare time, and for now I want to keep its design in one place. If you have a fix in mind, describe it in an issue and I'll take it from there.

## License

[MIT](LICENSE)
