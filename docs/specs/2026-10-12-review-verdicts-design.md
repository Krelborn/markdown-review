# Review verdicts: design spec

- **Date:** 2026-10-12
- **Status:** Approved in spec review (2026-10-13)
- **Changes:** the Submit popover and the review bar, the store's `review.json`, the browser and agent API, the CLI's `open`, `poll`, `inbox`, `reply` and `resolve` output, the skill and the README
- **Changes nothing in:** the threads files, anchoring or the canonical text, so `anchoringVersion` does not change. `server.json` and `GET /api/health` keep their fields. The API changes, so `protocolVersion` goes from 1 to 2.

## 1. Problem

1. **The only way to stop the agent is to approve.** Submit offers Request changes or Approve. Approve is the only verdict that ends the agent's `poll` loop, and its `next_step` says "Carry on with your task". A user who wants to stop must pick the option that tells the agent to go ahead, which on a plan or spec starts the implementation.
2. **The workaround depends on the agent reading it right.** Request changes with a comment saying "stop" needs a draft, and the loop still expects the agent to edit, resolve and poll again.
3. **Submit sends every draft in the repo.** Stale drafts on a doc unrelated to the review go out with its verdict. On 2026-10-09, test drafts on `README.md` went out with the approval of an unrelated spec.
4. **Approve hides what it leads to.** Nothing in the popover says what the agent will do once the user approves.

## 2. Assumptions

1. **One agent reviews in a checkout at a time.** Each git worktree has its own server and store, as in the [design spec](2026-10-08-markdown-review-design.md), so two agents rarely share a round.
2. **Agents follow `next_step`.** Every command already ends with one, and agents act on it. A verdict that stops the agent works only if they do.
3. **Whatever reason the user has for stopping, the next step happens in the chat.** The direction is wrong, they want to talk it over, they are stepping away, or they will take it from here. In each case the agent should stop and wait for them in the conversation, so one verdict covers all four.
4. **Downgrades are not supported.** An older server reports a version 2 `review.json` as invalid and treats the review as empty. The threads files are untouched, so the comments survive.
5. **macOS and Linux only**, as in the design spec.

## 3. Objective and success criteria

**Objective:** the user can end a review without approving it, and the agent then stops and waits for them in the chat. The verdicts say what the agent will do next. A submit sends only the drafts that belong to this review.

**Success looks like:**

1. **Hand back.** The Submit popover offers **Revise**, **Go ahead** and **Hand back to agent**. Hand back sends the drafts in scope and ends a waiting `poll` at once. `poll` and `inbox` print a hand-back summary and a `next_step` telling the agent to stop: no edits, no answers to threads, no `poll`, and no carrying on with its task. It tells the user in the chat and waits.
2. **Go ahead** behaves as Approve does now, under the new name and wording.
3. **Scope.** A submit sends drafts on the whole review, drafts on docs the agent opened this round, and drafts written since the round began. Older drafts on other docs stay as drafts, and the popover lists them as not sent.
4. **Resume.** After a hand-back, the agent runs `open` and then `poll` when the user asks to continue the review. Drafts the user wrote after handing back are sent with the next submit when the review resumes within 12 hours.
5. **Forgotten rounds expire.** A round with no verdict, and no `open` or submit for 12 hours, is not joined by the next `open`, so it can't widen what later submits send.
6. **Next task.** `open --next-task "<text>"` puts that text in the popover under Go ahead.
7. **Badge.** The review bar shows "Going ahead" or "Handed back" while the round has that verdict.
8. **Upgrade.** A version 1 `review.json` is read without a reported problem, and the next write saves version 2.
9. **Nothing else moves.** `pnpm verify`, `pnpm build`, `pnpm test:e2e` and `fallow audit` pass.

## 4. Decisions

| Topic | Choice | Alternatives considered | Why |
| --- | --- | --- | --- |
| Verdicts | `revise`, `go-ahead`, `hand-back`, labelled **Revise**, **Go ahead** and **Hand back to agent** | Add Stop beside Request changes and Approve | Chosen by the user. The verdict is really an instruction to the agent, and "Approve" hid that it means "start building" |
| What Hand back sends | The drafts in scope, as Go ahead does | Keep them as drafts; let the user choose | Chosen by the user. The drafts tell the agent why the user stopped |
| The agent after Hand back | Stops, sums up the comments in the chat, and waits for the user | Abandon the task; pause and resume polling | Chosen by the user. It fits every reason for stopping |
| The round after Hand back | Ended, as after Go ahead. To resume, the agent runs `open` and `poll` | A paused state that keeps the round open | Drafts and threads outlive rounds, so ending loses nothing, and no new state is needed |
| Where Hand back lives | A third radio in the Submit popover | A button beside the agent status | A second control would be a second way to send drafts |
| Default verdict | Unchanged: Revise when a submit would send drafts, otherwise Go ahead. Never Hand back | Remember the last choice | Stopping should be deliberate |
| Several submits in a round | The latest verdict is the round's verdict. Revise after Go ahead or Hand back starts the round going again | Make an ended round final | Matches today, where Request changes clears an approval |
| Where the round lives | A `round` record in `review.json`: `documents`, `startedAt`, `lastOpenedAt`, `nextTask` and `verdict` | Keep `requestedAt` and `approvedAt` and add more timestamps | The scope rule, expiry and the next task all describe the round. One record replaces the timestamp comparison in `toReviewState` |
| Store upgrade | `review.json` gets its own version, 2, and a version 1 file is upgraded in memory when read. The threads files stay at version 1 | Bump `storeFileVersion` for every file; add fields without a version | Only `review.json` changes. A downgraded server then loses only the review file, not the threads |
| What a submit sends | Drafts on the whole review, on a doc the agent opened this round, or written since the round began. With no round, every draft | Only the doc on screen; only opened docs; only recent drafts; a checkbox per doc | Chosen by the user. Opened docs alone would hold back comments on a linked doc. Recent drafts alone would hold back a resumed review's drafts |
| Drafts a submit keeps | Listed in the popover under "Not sent" | An Include control; marks in the sidebar | Chosen by the user: listing them is enough |
| Where the scope rule lives | `isDraftInRound` in `src/shared/review`, used by the store and the browser | The server sends the scope in each snapshot | One function, so the popover can't promise something the store doesn't do |
| When a round starts | At the hand-back, if the user handed the previous round back less than 12 hours ago. Otherwise at the `open` | Always at the `open`; also at the end of a round that went ahead | Drafts written after a hand-back, before the agent opens the doc again, belong to the resumed review. Drafts left on other docs while the agent carries on after Go ahead are not part of its next review |
| Joining a round | `open` adds its doc to a round with no verdict that had an `open` or submit in the last 12 hours. Otherwise it starts a new round | Every `open` starts a round, as now; a flag to join | An agent opening a plan and its spec gets one round, and a forgotten `open` from yesterday is not joined |
| What expiry affects | Only whether `open` joins. A submit always uses the stored round | Also treat an expired round as no round when submitting | Keeps the browser's rule free of the clock, and no submit changes meaning while the user is writing it |
| Saying what Go ahead leads to | `open --next-task "<text>"`, one line of at most 200 characters, shown under Go ahead. Optional. Without it, a generic sentence | Required; per-verdict texts | Cheap, and it makes what Go ahead leads to visible. Optional, because an agent may have nothing more to do |
| Name of the field | `nextTask` | `then` | An object with a `then` property is a thenable, which JavaScript treats as a promise |
| `--next-task` on a joining `open` | Replaces the round's text when given, keeps it otherwise | Always replace | A second `open` for a linked doc shouldn't wipe the first one's text |
| Update offer | Only after Go ahead | After either ending verdict | After a hand-back the user is busy with whatever made them stop |
| Bar badge | "Going ahead" (`success`, solid) and "Handed back" (`neutral`, solid) | Keep "Approved" | Chosen by the user. It matches the verdict names |
| CLI wording | Sentences in the new terms: "The user said go ahead", "The user asked to hand back to you" | Keep "Review approved" | Chosen by the user: the wording can change |
| API shape | `round: ReviewRound \| null` replaces `review: ReviewState` in every response | Keep `review` and add fields | `approved`, `approvedAt` and `requestedAt` all go, so keeping `review` would only keep a name |

## 5. Behaviour

### The round

`review.json`, version 2:

```json
{
  "round": {
    "documents": ["docs/plan.md"],
    "lastOpenedAt": "2026-10-12T09:00:00.000Z",
    "nextTask": "implement the plan in src/server",
    "startedAt": "2026-10-12T09:00:00.000Z",
    "verdict": { "at": "2026-10-12T09:40:00.000Z", "kind": "revise" }
  },
  "threads": [],
  "version": 2
}
```

- `round` is null until the first `open`.
- `verdict` is the latest submit in the round, or null before the first. The round **ended** when its verdict is `go-ahead` or `hand-back`. `roundOutcome(round)` returns that verdict, or null.
- `documents` is empty for a round opened without a path.
- **Upgrade.** A version 1 file, `{ approvedAt, requestedAt, threads, version: 1 }`, reads as version 2. A null `requestedAt` gives a null `round`. Otherwise `startedAt` and `lastOpenedAt` are `requestedAt`, `documents` is empty and `nextTask` is null. `verdict` is `{ kind: "go-ahead", at: approvedAt }` when `approvedAt` is later than `requestedAt`, and null otherwise. The next write saves version 2.

### Opening

`POST /api/agent/open` takes `{ path?, nextTask? }`. The store's `openRound(path, nextTask)` replaces `requestReview()`:

- **Join** when the round has no ending verdict, and the later of `lastOpenedAt` and `verdict.at` is less than 12 hours ago. It adds `path` to `documents` if it is new, sets `lastOpenedAt` to now, and replaces `nextTask` when one is given.
- **Start** otherwise, with `documents` holding `path` if given, `lastOpenedAt` now, `nextTask` as given or null, and `verdict` null. `startedAt` is the previous round's `verdict.at` when the user handed that round back less than 12 hours ago, but never later than now, and now otherwise.

The `open` output doesn't change.

### Submitting

`POST /api/submit` takes `{ verdict: "revise" | "go-ahead" | "hand-back" }` and answers `{ round, submittedThreadIds }`.

- A thread's draft is **in scope** when `isDraftInRound(thread, round)` holds. That is when there is no round, when the thread is on the whole review, when its doc is in `round.documents`, or when `draft.at` is at or after `round.startedAt`. Editing an old draft brings it into scope, because the edit moves `draft.at`.
- The store submits every in-scope draft as today and leaves the rest as drafts. It sets `round.verdict` to `{ kind: verdict, at: now }`. With no round, it first starts one as an `open` of the docs list would, so Go ahead and Hand back end a waiting `poll` even when no review was opened.
- `revise` with no in-scope draft fails with `invalid-state`, "There are no drafts to submit", as Request changes does today. `go-ahead` and `hand-back` are allowed with none.
- `waitForInbox` returns at once when `roundOutcome(round)` isn't null or a thread needs the agent, so either ending verdict ends a waiting `poll`.

### What the agent is told

`formatInbox` starts with a summary line chosen by `roundOutcome`, and `nextSteps.ts` gains a step for each case.

Go ahead, nothing waiting:

```
The user said go ahead. No threads need you.

next_step: The user said go ahead. Carry on with your task; do not run `markdown-review poll` again for this review.
```

Go ahead with a comment:

```
The user said go ahead, 1 thread needs you (docs/plan.md: 1)

#16 docs/plan.md:3
  quote: "cache results for 24h"
  user: Make it 12h.

next_step: The user said go ahead, with comments. Address #16 and run `markdown-review resolve 16 "<what changed>"`, then carry on with your task; do not run `markdown-review poll` again for this review.
```

Hand back with comments:

```
The user asked to hand back to you, with comments on 2 threads (docs/plan.md: 2)

#3 docs/plan.md:3
  quote: "cache results for 24h"
  user: This whole approach is wrong; let's talk.
#4 docs/plan.md:7
  quote: "Retries happen three times."
  user: Why three?

next_step: Stop here: do not edit the docs, resolve or reply to #3 and #4, run `markdown-review poll` or carry on with your task. Tell the user in the chat that you have stopped and what their comments say, and wait for their instructions.
```

Hand back with nothing waiting:

```
The user asked to hand back to you. No threads need you.

next_step: Stop here: do not edit the docs, run `markdown-review poll` or carry on with your task. Tell the user in the chat that you have stopped, and wait for their instructions.
```

- A round with no ending verdict prints as today.
- `poll` says "No comments yet" only when it timed out, no thread needs the agent and `roundOutcome` is null.
- `formatAgentAction`, in a round the user handed back:
  - With threads left: "The user handed the review back, so act on #4 only as they ask in the chat."
  - With none left: "The user handed the review back. Tell them what you changed and wait for their instructions. Only if they ask you to continue the review, run `markdown-review open <path> --next-task "<what you will do once the user says go ahead>"`, then `markdown-review poll`."
  - After Go ahead it says what it says after an approval today.
- `poll` and `inbox` read update notices only when `roundOutcome` is `go-ahead`. `formatUpdateNotices` renames `approved` to `wentAhead`, and its not-yet line ends "offer to update once they say go ahead."
- `helpText`:
  - `open`: `markdown-review open [path] [--next-task <text>]`, "Start a review round, or add the doc to the one in progress, and show the doc (or the docs list) in the user's browser. --next-task says what you will do once the user says go ahead; the user sees it. Prints the URL."
  - `inbox`: "Print how the user ended the review, if they have, and the threads that need you, then return at once."
  - `poll`: "Wait until the user submits, then print what needs you."
- `open` rejects a `--next-task` that is blank, longer than 200 characters or more than one line, with exit code 2: "--next-task must be one line of at most 200 characters".

### The skill

In `skills/markdown-review/SKILL.md`:

- **Review loop, step 1:** "Run `markdown-review open <doc.md> --next-task "<what you will do once the user says go ahead>"`, for example `--next-task "implement the plan in src/server"`. It starts a review round and shows the doc in the user's browser, with your next task under Go ahead."
- **"Approval" becomes "How a review ends":**

```markdown
## How a review ends

The user ends a review in one of two ways, and `poll` and `inbox` say which on their first line.

- **Go ahead** ("The user said go ahead"): address any comments that came with it, then carry on with your task. Do not run `poll` again for that review.
- **Hand back** ("The user asked to hand back to you"): stop. Do not edit the docs, answer the threads, run `poll` or carry on with your task. Tell the user in the chat that you have stopped and what their comments say, and wait for their instructions. If they ask you to continue the review, run `markdown-review open <doc.md> --next-task "<what you will do once the user says go ahead>"`, then `markdown-review poll`.
```

- **Updates:** "Once the user says go ahead" replaces "Once the review is approved".

### Browser

**Submit popover.** `VerdictChoice` offers three radios. "Drafts" in the descriptions means the drafts in scope:

| Radio | With drafts | Without drafts |
| --- | --- | --- |
| **Revise** | "Send your comments. The agent revises the docs, answers each one, and waits for you." | Disabled, with the same text |
| **Go ahead** | "Send your comments and end the review. The agent addresses them, then carries on with its task." | "End the review. The agent carries on with its task." |
| **Hand back to agent** | "Send your comments and end the review. The agent stops and waits for you in the chat." | "End the review. The agent stops and waits for you in the chat." |

With a `nextTask`, Go ahead's description ends "then carries on: implement the plan in src/server" or "The agent carries on: implement the plan in src/server" in place of "carries on with its task".

**Drafts summary.** `countDraftsByDocument(threads, round)` returns `{ sent, kept }`, each a list of `DraftCount`.

- `DraftsSummary` shows "Sends 3 drafts:" with a badge per doc, as now, from `sent`.
- When `kept` isn't empty, it adds a second row: "Not sent, from before this review:" with a badge per doc.
- With nothing sent it says "You have no drafts for this review." The kept row still appears below it.

**Submit button.** Its counter and its `primary` variant follow `sent`, not every draft. `SubmitMenu` keeps holding the verdict while the popover is open.

**Review bar.** While `roundOutcome(round)` is `go-ahead` it shows a solid `success` badge, "Going ahead". While it is `hand-back` it shows a solid `neutral` badge, "Handed back". `App` passes `round`, and null before the first `open`, in place of `unrequestedReview`.

## 6. Delivery

Three slices, each its own pull request, released together or in order. Slice 1 makes every change to the stored and wire formats, so the protocol changes once.

1. **Verdicts and Hand back:**
   - the round record with every field;
   - the version 1 upgrade;
   - `joinOrStartRound` with joining and expiry;
   - `round` in every response;
   - `nextTask` accepted by `POST /api/agent/open` and stored;
   - the three verdicts;
   - the CLI wording and steps;
   - the badge;
   - the skill's "How a review ends";
   - `protocolVersion` 2.

   Submit still sends every draft.
2. **Scoped submit:** `isDraftInRound`, the store's use of it, `countDraftsByDocument`'s `sent` and `kept`, the "Not sent" row and the Submit counter.
3. **Next task:** `open --next-task`, the Go ahead description, the help text, and the skill's loop step.

## 7. Commands

```
GITHUB_TOKEN=$(gh auth token) pnpm install   # once, in a new worktree
pnpm verify                                  # lint, format check, typecheck, tests
pnpm build
pnpm test:e2e
pnpm vitest run --project node src/server/store src/cli src/shared
pnpm vitest run --project web src/web/components/ReviewBar
pnpm vitest run --project integration src/integration/agentLoop.integration.test.ts
pnpm exec fallow audit
```

Try it by hand:

```
pnpm build
export MARKDOWN_REVIEW_NO_BROWSER=1
node dist/cli.js open README.md --next-task "update the install section"
node dist/cli.js poll --timeout 600   # then choose Hand back to agent in the browser
```

## 8. Project structure

| Path | What |
| --- | --- |
| `src/shared/review/reviewRoundSchema.ts` | `verdictSchema`, `nextTaskSchema`, `reviewRoundSchema` and their types. `Verdict` moves here from `apiRequestSchemas.ts` |
| `src/shared/review/reviewFileSchema.ts` | Version 2, with `round` in place of `approvedAt` and `requestedAt` |
| `src/shared/review/reviewFileVersion.ts` | `reviewFileVersion = 2`. `storeFileVersion` stays 1 and versions the threads files |
| `src/shared/review/roundOutcome.ts` | The verdict that ended the round, or null |
| `src/shared/review/isDraftInRound.ts` | Whether a submit sends a thread's draft |
| `src/shared/review/ReviewState.ts` | Deleted |
| `src/shared/api/apiRequestSchemas.ts` | The three verdicts; `nextTask` on the open request |
| `src/shared/api/apiResponseSchemas.ts` | `round` in place of `review` |
| `src/shared/api/protocolVersion.ts` | 2 |
| `src/server/store/joinOrStartRound.ts` | Joins the round or starts the next one, from the round, the path, the next task and the time |
| `src/server/store/storedReviewFileSchema.ts` | Reads `review.json` at version 1 or 2, upgrading version 1 |
| `src/server/store/StoreFiles.ts` | `readReviewFile` reads through `storedReviewFileSchema` |
| `src/server/store/ReviewStore.ts` | `openRound` in place of `requestReview`; `submit` sends the in-scope drafts and records the verdict |
| `src/server/store/toReviewState.ts`, `emptyReviewFile.ts` | `toReviewState` is deleted; the empty file has a null `round` |
| `src/server/http/agentRoutes.ts`, `browserRoutes.ts`, `waitForInbox.ts` | Pass `nextTask`; answer `round`; end a poll on either ending verdict |
| `src/cli/commands/openCommand.ts`, `src/cli/ServerClient.ts` | `--next-task` |
| `src/cli/formatInbox.ts`, `nextSteps.ts`, `formatAgentAction.ts` | The new summaries and steps |
| `src/cli/commands/pollCommand.ts`, `inboxCommand.ts`, `readUpdateNotices.ts`, `formatUpdateNotices.ts`, `helpText.ts` | `roundOutcome` in place of `approved`; the new wording |
| `src/web/review/countDraftsByDocument.ts` | `{ sent, kept }` |
| `src/web/components/SubmitMenu/` | Three verdicts, the next task, and the "Not sent" row |
| `src/web/components/ReviewBar/ReviewBar.tsx`, `src/web/components/App/App.tsx` | The badges; `round` in place of `review` |
| `src/web/testing/createFakeReviewApi.ts` | Keeps a round and applies the scope rule |
| `src/e2e/testing/reviewTest.ts` | `submitDrafts` takes "Revise", "Go ahead" or "Hand back to agent" |
| `skills/markdown-review/SKILL.md` | The loop step, "How a review ends", and the Updates wording |
| `README.md` | Usage, Commands, Updates and How it works in the new terms. Retake `docs/images/submit-light.png` and `submit-dark.png` by hand |

## 9. Code style

The repository's TypeScript, comments, React and Vitest standards apply, as loaded by the `coding-standards` plugin. That means:

- full words in names;
- explicit return types on exports;
- doc comments that state only the contract;
- one class per module;
- zod at every boundary, including the version 1 file.

For example:

```ts
import { z } from "zod";

import { documentPathSchema } from "./anchorSchema";

export const verdictSchema = z.enum(["revise", "go-ahead", "hand-back"]);

export const nextTaskSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((text) => !text.includes("\n"), "must be one line");

export const reviewRoundSchema = z.strictObject({
  documents: z.array(documentPathSchema),
  lastOpenedAt: z.iso.datetime(),
  nextTask: nextTaskSchema.nullable(),
  startedAt: z.iso.datetime(),
  verdict: z.strictObject({ at: z.iso.datetime(), kind: verdictSchema }).nullable(),
});

export type ReviewRound = z.infer<typeof reviewRoundSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
```

```ts
import type { ReviewRound } from "./reviewRoundSchema";
import type { Thread } from "./threadSchema";

/**
 * Tells whether a submit sends a thread's draft
 *
 * @param thread the thread
 * @param round the current round, or null before any review was opened
 * @returns false when the thread has no draft; otherwise true when there is no round, or the draft is on the whole
 *   review, on a doc opened this round, or written since the round began
 */
export function isDraftInRound(thread: Thread, round: ReviewRound | null): boolean {
  if (thread.draft === undefined) {
    return false;
  }
  if (round === null || thread.anchor.kind === "review") {
    return true;
  }
  return (
    round.documents.includes(thread.anchor.document) ||
    Date.parse(thread.draft.at) >= Date.parse(round.startedAt)
  );
}
```

## 10. Testing

- **Unit (`node` project):**
  - `isDraftInRound`: no draft; no round; a whole-review draft; an opened doc's draft from before the round; another doc's draft from before and from after the round began; an old draft edited since.
  - `roundOutcome`: null round, no verdict, each verdict.
  - `joinOrStartRound`:
    - joins a round going on, and adds a new doc only once;
    - keeps `nextTask` when none is given and replaces it when one is;
    - starts a new round after Go ahead and after Hand back;
    - starts a new round when the last `open` and submit are 12 hours old, and joins at just under 12 hours;
    - starts a new round at the hand-back when that was within 12 hours, and at the `open` after Go ahead or otherwise;
    - leaves a new round without a next task when none is given.
  - `storedReviewFileSchema`: never requested, approved after the request, approved before it, approved as it was requested, requested without approval.
  - `ReviewStore`:
    - Hand back ends the round until the next `open`;
    - Revise after Hand back starts the round going again;
    - Go ahead or Hand back with no round starts one that ended with that verdict;
    - submit leaves out-of-scope drafts as drafts and returns only the submitted IDs;
    - Revise with only out-of-scope drafts fails;
    - a version 1 file reads without a problem and is written as version 2.
  - `pollRoutes`: returns at once after a hand-back.
  - `formatInbox`, `formatAgentAction` and `formatUpdateNotices`: each outcome, with and without threads.
  - `openCommand`: `--next-task` blank, too long and multi-line.
- **Web (`web` project):**
  - `ReviewBar`:
    - the three verdicts and their descriptions, with and without drafts and a next task;
    - Revise disabled with only kept drafts;
    - the "Not sent" row;
    - the counter counting only sent drafts;
    - each badge;
    - submitting Hand back.
  - `countDraftsByDocument`: `sent` and `kept`.
- **Integration:** `agentLoop.integration.test.ts`:
  - a hand-back ends a waiting poll with the hand-back output, and the next `open` starts a new round;
  - `open --next-task` stores the text, which `GET /api/threads?all=1` returns.

  The existing tests move to the new verdict names and wording.
- **End-to-end (`review.e2e.ts`):**
  - Hand back to agent ends the agent's poll and shows "Handed back".
  - A stale draft: a draft on `docs/spec.md` before any review is opened, then `open docs/plan.md` and a draft on `docs/plan.md`. The popover lists `spec.md` under "Not sent", and Revise hands the agent only the `plan.md` thread. (Go ahead would send a draft written during a round, so a stale draft needs one from before the round.)
  - The next task shows under Go ahead.
  - The approval test becomes Go ahead with "Going ahead".

## 11. Boundaries

- **Always:**
  - decide scope only with `isDraftInRound`;
  - keep the hand-back `next_step` explicit about what the agent must not do;
  - run the hand-back loop by hand in Claude Code and in Codex before merging slice 1, to check that agents stop;
  - run `fallow audit` before committing.
- **Ask first:**
  - changing `server.json` or `/api/health`;
  - changing the threads files' format;
  - making expiry affect a submit;
  - adding an Include control or sidebar marks for kept drafts.
- **Never:**
  - delete or discard a draft because a submit kept it;
  - send a draft out of scope;
  - let a hand-back print update commands.

## 12. Open questions

None.
