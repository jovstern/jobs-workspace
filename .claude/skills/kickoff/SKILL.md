---
name: kickoff
description: Start a new project - interview, roadmap, CLAUDE.md, starter code with quality gates, and a protected GitHub repo.
disable-model-invocation: true
---

# /kickoff

Sets up a new project so that every later milestone runs through `/milestone`. Run once, in
the project's root folder.

Do the steps in order. Stop and report if one fails; do not skip ahead.

## 1. Preconditions

Check all of these before asking the user anything:

- `.claude/gsd-core/VERSION` exists. If not, stop: GSD Core is not installed in this folder.
- The folder is a git repository on branch `main`.
- `gh auth status` succeeds, and `ffmpeg` and `node` are on the PATH.
- `.planning/` does not exist. If it does, the project is already kicked off: say so and
  point to `/milestone`.

## 2. Interview and roadmap

Run `/gsd-new-project`. During it:

- **The stack is already decided.** Read `.claude/skills/stack-conventions/SKILL.md` first
  and treat it as a given. Do not ask about, research or propose alternatives for framework,
  styling, forms, data fetching or state. The one stack question to ask is whether the
  project needs a backend.
- **Spend the questions on the product:** who it is for, the core flow, what is out of
  scope, what "done" looks like for a first usable version, and anything risky or unknown.
  Ask one question at a time, keep going until the answers stop changing the plan, and say
  what you would assume if the user has no opinion.
- **Workflow preference questions are already answered** by
  `.claude/skills/kickoff/gsd-config.json`. Choose the matching options yourself instead of
  asking.
- **Roadmap shape:** each phase must end in something the user can see working and that a
  short GIF can show. Order phases so the riskiest unknown is proven first.

Show the roadmap and wait for the user's approval before continuing.

## 3. Starter code

`bash .claude/skills/kickoff/scaffold.sh <project-name>`

This copies the starter template, installs dependencies and runs every gate. It must end
with "Scaffold complete". If the project needs a backend, add `server/` as described in
stack-conventions now, with its own `check` script, and add its steps to
`.github/workflows/ci.yml`.

## 4. CLAUDE.md

Write `CLAUDE.md` at the repo root from `.claude/skills/kickoff/CLAUDE.template.md`.

- 60 lines at most. Every line must be something an agent would get wrong without it.
- No restating of what the code, `package.json` or `.planning/` already says.
- Leave `.claude/CLAUDE.md` alone; GSD manages that file.

## 5. GitHub repository

Ask the user two things in one question: the repository name and whether it is public or
private. Tell them that on a free GitHub plan, branch protection only works on public
repositories. Creating a repository is visible to others, so do not create it before they
answer.

Then:

1. `git add -A && git commit -m "chore: project kickoff"`
2. `gh repo create <owner>/<name> --<public|private> --source . --push`
3. `node .claude/skills/kickoff/apply-config.mjs <owner>/<name>`, then commit and push the
   config change. This is the last direct push to `main`.
4. `bash .claude/skills/kickoff/protect-main.sh <owner>/<name>`. If GitHub refuses
   (private repo on a free plan), say so plainly: the PR-only rule then depends on
   discipline, not enforcement.

## 6. Report

Tell the user: the repository URL, the number of phases in the roadmap, whether `main` is
protected, and that the next step is `/milestone`.
