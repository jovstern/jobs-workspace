---
name: milestone
description: Run one milestone end to end - questions, plan, build, test, review, demo, pull request.
argument-hint: "[phase number]"
disable-model-invocation: true
---

# /milestone

Runs one roadmap phase from questions to an open pull request. The user approves the plan
and merges the PR; everything else is yours.

Phase to run: `$ARGUMENTS`. If empty, use the first phase in `.planning/ROADMAP.md` that is
not complete.

Work through the stages in order. Each stage has an exit condition; do not start the next
one until it is met. If you are resuming, read `.planning/STATE.md` and the phase folder to
find the first stage that is not finished, and continue from there.

## Rules for the whole run

- Never push to `main`, never merge a pull request, never use `--no-verify`.
- Never weaken a gate to get past it (see `.claude/skills/quality-gates/SKILL.md`).
- Stop and report when: a gate stays red after two fix attempts, the plan turns out to be
  wrong, or the work needs something outside the phase's scope.

## 0. Start clean

1. Working tree must be clean. If not, stop and show what is uncommitted.
2. If the previous phase's PR is still open, stop and tell the user to merge it first.
3. `git switch main && git pull --ff-only`
4. Get the phase's branch name and create it **now**, before any planning commits:

   ```bash
   node .claude/gsd-core/bin/gsd-tools.cjs query init.execute-phase <N> --pick branch_name
   git switch -c <branch_name>    # or `git switch <branch_name>` if it exists
   ```

   Planning files committed on local `main` would be left out of the PR, so everything from
   here on happens on this branch.

## 1. Questions — `/gsd-discuss-phase <N>`

Before the phase's own questions, ask the user what changed since the last milestone: new
ideas, things they disliked in what was built, decisions to revisit. If an answer changes
the roadmap, update it with `/gsd-phase --edit` before going on.

**Exit:** the phase's `CONTEXT.md` exists and the user has no open questions.

## 2. Plan — `/gsd-plan-phase <N>`

When planning finishes, give the user a short summary: what will be built, the tasks, the
tests that will prove it, the flow the demo will show, and anything you are unsure about.

**Exit:** the user explicitly approves the plan. Do not write code before that. If they ask
for changes, replan and ask again.

## 3. Build — `/gsd-execute-phase <N>`

**Exit:** every plan has a summary, and `npm run check` and `npm run e2e` both pass.

## 4. Review — `/gsd-code-review <N> --fix`

Re-run both gates after the fixes.

**Exit:** no Critical or Warning findings remain, gates pass.

## 5. Verify — `/gsd-verify-work <N>`

Start the app and exercise the phase's acceptance criteria in a real browser. Items that
need the user's judgment are asked here.

**Exit:** verification status is `passed`.

## 6. Demo — the `pr-demo` skill

**Exit:** `phase-<NN>/demo.gif` is on the `pr-media` branch and you have looked at it.

## 7. Ship — `/gsd-ship <N>`

Then:

1. Confirm the PR body has the Demo image. If not, fix it as described in `pr-demo`.
2. `gh pr checks <number> --watch`. If a check fails, fix it on the branch and push.

**Exit:** the PR is open and every check is green.

## 8. Report

Give the user: the PR link, what was built in two or three sentences, what the demo shows,
anything deferred or worth a look, and that the PR is waiting for their merge.

If this was the last phase of the roadmap, say so and mention that `/gsd-complete-milestone`
tags the release once the PR is merged.
