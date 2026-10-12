---
name: milestone
description: Run the next block of the current milestone - questions and plan, then build and review, then verify, demo and pull request.
argument-hint: "[phase number]"
disable-model-invocation: true
---

# /milestone

A milestone (one roadmap phase) runs in **three blocks, each in a fresh session**:

| Block | Does | Ends when |
|---|---|---|
| 1. Plan | questions, issue, plan | the user approves the plan |
| 2. Build | build, code review | all gates are green |
| 3. Ship | verify, demo, pull request | the PR is open and green |

Run **one block per invocation**, then stop. Each block ends by telling the user:
"Run `/clear`, then `/milestone` for the next block." Never continue into the next block in
the same session: carrying one block's context into the next is what made this workflow
expensive. Everything a later block needs is on disk in `.planning/`.

Phase: `$ARGUMENTS`, or if empty the first phase in `.planning/ROADMAP.md` that is not
complete.

## Rules for every block

- Never push to `main`, never merge a pull request, never use `--no-verify`.
- Never weaken a gate to get past it (see `.claude/skills/quality-gates/SKILL.md`).
- Stop and report when a gate stays red after two fix attempts, the plan turns out to be
  wrong, or the work needs something outside the phase's scope.
- Keep context small: read a planning file only when a step needs it, and prefer the
  section you need over the whole file. Do not re-read `.claude/CLAUDE.md`; it is already
  loaded.

## Which block to run

Find the phase folder under `.planning/phases/` and its `MILESTONE.md` (this skill's own
record: issue number, research decision, plan approval, PR). Then:

1. A PR for this phase is open → nothing to run. Tell the user it is waiting for their
   merge and stop.
2. No plans, or `MILESTONE.md` has no `plan_approved` line → **Block 1**. If plans already
   exist but approval was never recorded, run only steps 6 and 7 of block 1 (issue, then
   summary and approval).
3. Plans approved, and either a plan has no summary or there is no finished code review →
   **Block 2**.
4. Build and review done, no PR → **Block 3**.

Before any block: the working tree must be clean (otherwise stop and show what is
uncommitted), and you must be on the phase branch. If the branch does not exist yet:

```bash
git switch main && git pull --ff-only
node .claude/gsd-core/bin/gsd-tools.cjs query init.execute-phase <N> --pick branch_name
git switch -c <branch_name>
```

Create it before any planning commit: planning files committed on local `main` would be
left out of the PR.

## Block 1 — Plan

1. **What changed.** Ask the user what changed since the last milestone: new ideas, things
   they disliked in what was built, decisions to revisit. If an answer changes the roadmap,
   update it with `/gsd-phase --edit` first.
2. **Questions.** `/gsd-discuss-phase <N>`.
3. **Size check.** If the phase clearly needs more than about five plans, propose a split
   to the user and, if they agree, move the later part into a new phase with
   `/gsd-phase --insert`. Large phases are the main cause of oversized planner runs.
4. **Research decision.** Phase research is needed only when the phase introduces a
   library, external API or technique the codebase does not already use. Tell the user
   which you chose and why in one sentence, and record it in `MILESTONE.md`. They can
   overrule it.
5. **Plan.** `/gsd-plan-phase <N>`, with `--skip-research` when research is not needed.
6. **Issue.** If `MILESTONE.md` has no issue number, create one from the phase's goal and
   success criteria in `ROADMAP.md` and record the number:

   ```bash
   gh issue create --title "Phase <N>: <name>" --body-file <file>
   ```

7. **Summary and approval.** Give the user a short summary: what will be built, the plans,
   the tests that will prove it, the flow the demo will show, and anything you are unsure
   about. When they explicitly approve, add `plan_approved: <date>` to `MILESTONE.md` and
   commit it. If they ask for changes, replan and ask again. Write no code in this block.

## Block 2 — Build

1. `/gsd-execute-phase <N>`
2. `npm run check` and `npm run e2e` must both pass.
3. `/gsd-code-review <N> --fix`, then run both gates again.
4. For each item the phase deferred (`deferred-items.md`, review findings pushed to a later
   phase) that has no issue yet, create one and note its number next to the item:

   ```bash
   gh label create deferred --color BFD4F2 --description "Deferred from a phase" 2>/dev/null || true
   gh issue create --label deferred --title "<item>" --body "<what, why deferred, from phase N>"
   ```

**Exit:** every plan has a summary, no Critical or Warning review findings remain, gates
pass.

## Block 3 — Ship

1. `/gsd-verify-work <N>`: start the app and exercise the acceptance criteria in a real
   browser. Items that need the user's judgment are asked here. Verification status must
   be `passed`.
2. The `pr-demo` skill: `phase-<NN>/demo.gif` is on the `pr-media` branch and you have
   looked at it.
3. `/gsd-ship <N>`
4. Link the issue: append `Closes #<issue>` to the PR body.

   ```bash
   gh pr view <number> --json body -q .body > <file>
   printf '\n\nCloses #<issue>\n' >> <file>
   gh pr edit <number> --body-file <file>
   ```

5. Confirm the PR body has the Demo image (fix as described in `pr-demo` if not), then
   `gh pr checks <number> --watch`. If a check fails, fix it on the branch and push.
6. Record the PR number in `MILESTONE.md` and report: the PR link, what was built in two or
   three sentences, what the demo shows, anything deferred (with issue numbers), and that
   the PR is waiting for their merge.

If this was the last phase of the roadmap, mention that `/gsd-complete-milestone` tags the
release once the PR is merged.

## Checking the cost

`python3 .claude/skills/milestone/usage-report.py --since <YYYY-MM-DD>` shows token use by
agent and by context size for this project. Run it when the user asks what a block cost.
