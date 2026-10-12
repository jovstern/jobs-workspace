<!-- GSD:project-start source:PROJECT.md -->

## Project

**Jobs Workspace**

A redesigned, LinkedIn-style jobs page for a single job seeker: one three-pane workspace
where searching for jobs, tracking applications and getting AI fit analysis all happen
without leaving the page. It is "a new smart, personal place to search and monitor the
next role": not only a place to look for a job, but one that helps the user find their best
fit and shows what is missing from their resume or what they need to learn.

**Core Value:** The user can search for jobs and see and update the progress of every application on the
same page, without ever losing their search context.

### Constraints

- **Tech stack**: Fixed by `.claude/skills/stack-conventions` (Vite, React with the compiler,
  TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zod, Zustand, Express in
  `server/`) — decided before kickoff; not open for alternatives
- **Backend**: Stateless Express server — serves seeded jobs and proxies AI calls; holds no user data
- **Persistence**: Browser storage only — user chose no server-side user data for the first version
- **AI**: Claude via the Anthropic API, called only from the server — the API key must never
  reach the browser; supplied by the user in a local `.env`
- **Privacy**: The resume is sent to the server only as part of an AI request and is not stored there
- **Process**: Every phase must end in something visibly working that a short GIF can show;
  the riskiest unknown is proven first
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

The stack is fixed. Rules: `.claude/skills/stack-conventions/SKILL.md`.
Library choices, versions and the reasons behind them: `.planning/research/STACK.md`.
Read that file only when a task touches a library decision; do not load it by default.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| kickoff | Start a new project - interview, roadmap, CLAUDE.md, starter code with quality gates, and a protected GitHub repo. | `.claude/skills/kickoff/SKILL.md` |
| milestone | Run one milestone end to end - questions, plan, build, test, review, demo, pull request. | `.claude/skills/milestone/SKILL.md` |
| pr-demo | Record a demo GIF of the current phase's main user flow and publish it for the pull request. Use after a phase is verified and before it is shipped, or when a PR is missing its demo. | `.claude/skills/pr-demo/SKILL.md` |
| quality-gates | The definition of done for this project. Read before planning tasks, before saying any work is complete, and when verifying a phase. | `.claude/skills/quality-gates/SKILL.md` |
| stack-conventions | Required stack and coding rules for this project (Vite, React with the compiler, TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zustand, Express). Read before planning, writing or reviewing any code. | `.claude/skills/stack-conventions/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
