---
name: markdown-review
description: Hands markdown docs you wrote, such as plans, specs and design notes, to the user to review in their browser, then reads their comments back so you can edit the docs and answer each one. Use when the user asks you to have a doc reviewed, or when a doc you wrote needs their sign-off before you carry on.
---

# Markdown Review

The user reviews your markdown in a browser and comments on passages, blocks, whole docs or the review as a whole. You read the comments with the `markdown-review` command, edit the docs, and answer each comment.

If the `markdown-review` command is not found, install it with `npm install --global @krelborn/markdown-review`.

## The review loop

1. Run `markdown-review open <doc.md>`. It starts a review round and shows the doc in the user's browser.
2. Run `markdown-review poll`. It waits until the user submits, then prints each comment: its thread ID, file, line range, the quoted text and the user's words.
   - Give the shell command a timeout of at least 600000 ms. `poll` gives up after 540 seconds by default; run it again if it says there are no comments yet.
   - In Claude Code, run it with `run_in_background` and `--timeout 7080`, and a Bash timeout of 7200000 ms. A submit still ends it at once.
3. Edit the docs. Then answer every thread:
   - `markdown-review resolve <id> "<what changed>"` when you have addressed it.
   - `markdown-review reply <id> "<question>"` when you need the user's input.
   - For a long message, put it in a file and pass `--file <path>`, or pass `--file -` and write it to standard input.
4. Run `markdown-review poll` again for the next round.

`markdown-review inbox` prints what `poll` would, without waiting, for picking comments up later.

## Approval

The review ends when the user approves it, and `poll` and `inbox` then start with "Review approved". Address any comments that came with the approval, then carry on with your task. Do not run `poll` again for that review.

## Good to know

- A quote is the text as the browser shows it, not the markdown source. The line range is exact, so use it to find the passage.
- If `poll` is stopped before the user submits, nothing is lost: run it again.
- Every command ends with a `next_step` line that says what to do next. `markdown-review --help` lists the commands.
- Run `markdown-review stop` to stop the review server when you have finished.
