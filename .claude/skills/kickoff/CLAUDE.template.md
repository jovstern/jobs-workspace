# <project name>

<Two or three sentences: what this is, who it is for, what is explicitly out of scope.>

## Commands

- `npm run dev` — start the app
- `npm run check` — format, lint, typecheck, unit tests, build
- `npm run e2e` — browser tests (recorded)

## How work happens

- Work runs one milestone at a time with `/milestone`. Do not write feature code outside it;
  for a small fix use `/gsd-quick`.
- The plan and its state live in `.planning/` (`PROJECT.md`, `REQUIREMENTS.md`,
  `ROADMAP.md`, `STATE.md`). Read them instead of guessing.

## Hard rules

- Follow `.claude/skills/stack-conventions/SKILL.md` and
  `.claude/skills/quality-gates/SKILL.md`.
- Never push to `main`, merge a pull request, or bypass a hook or check. The user merges.
- Every pull request carries a demo GIF (`pr-demo` skill).
- Ask before adding a dependency or changing lint, TypeScript or CI configuration.

## Project specifics

<Only facts an agent would get wrong without being told: domain terms, external services,
environment variables, known traps. Delete this section if there are none.>
