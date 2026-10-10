---
name: quality-gates
description: The definition of done for this project. Read before planning tasks, before saying any work is complete, and when verifying a phase.
---

# Quality gates

Work is done only when every gate below passes on the current code. "It should pass" is not
a pass: run the command and read the output.

## Gates

| Gate | Command |
|---|---|
| Format, lint, types, unit tests, build | `npm run check` |
| Browser tests | `npm run e2e` |

If the project has a `server/` package, run its `npm run check` too.

## Rules

- **Every behavior change comes with a test.** Logic and components get a Vitest test next
  to the file. Each user-facing flow in the phase's acceptance criteria gets a Playwright
  test in `e2e/`.
- **Plans must include the tests.** A task that adds behavior names the test that proves it.
- **Run the gates before every commit that ends a task**, and again before the phase is
  verified.
- **Never bypass a gate.** No `--no-verify`, no skipped or deleted tests, no loosened lint
  or TypeScript settings, no `eslint-disable` to get past an error. Changing a gate's
  configuration needs the user's explicit approval.
- **A red gate you cannot fix in two attempts is a stop.** Report what fails and why
  instead of working around it.
- **Report honestly.** State which commands ran and their result. Never describe a gate as
  passing unless you saw it pass in this session.
