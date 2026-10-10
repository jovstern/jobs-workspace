# Jobs Workspace

A redesigned LinkedIn-style jobs page for one job seeker: a three-pane workspace where job
search, application tracking and AI resume-to-job fit analysis share one page. Out of scope:
real job feeds, accounts, submitting applications, mobile layout, other LinkedIn pages.

## Commands

- `npm run dev` — start the app
- `npm run check` — format, lint, typecheck, unit tests, build
- `npm run e2e` — browser tests (recorded)
- `cd server && npm run dev` — start the API on `127.0.0.1:3001`
- `cd server && npm run check` — server lint, typecheck, tests (root `check` does not run it)

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

- **Signed-off readings of the stack rules** (PROJECT.md, Key Decisions): fit analyses, the
  parsed resume and chat history are the user's own records and live in persisted Zustand
  stores; chat streams inside a TanStack Query mutation; TanStack Router is an approved
  addition for URL state. Job listings stay in TanStack Query only.
- **Applications store the job id only**, never a copy of the job. Result card, detail pane
  and rail all derive from the one applications store; never store a derived status.
- **The fit score is computed in code** from per-requirement ratings (met / partial / not
  evidenced) with resume quotes. Never ask the model for a score.
- **The server is stateless.** Never store or log a resume, a request body or model output;
  log route, status and duration only.
- **The AI provider is Google Gemini; `GEMINI_API_KEY` lives in `server/.env` only.** Never give it a `VITE_` prefix or read
  it outside `server/`. Model ids go in one server config module.
- **Synthetic resumes only** in tests, fixtures, e2e runs and demo GIFs. Never a real person's.
- **No LinkedIn logo, name or trademarked assets**; companies in seed data are fictional.
  Seed job ids are hand-assigned and must never change.
- Stage dates are date-only `YYYY-MM-DD` strings; logic that depends on "today" takes the
  date as an argument.
- `server/` has its own `package.json`, lockfile and ESLint config; root ESLint ignores it,
  root Prettier covers it.
