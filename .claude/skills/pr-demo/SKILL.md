---
name: pr-demo
description: Record a demo GIF of the current phase's main user flow and publish it for the pull request. Use after a phase is verified and before it is shipped, or when a PR is missing its demo.
---

# PR demo

Every pull request shows what was built. The PR's Demo section links to
`phase-<NN>/demo.gif` on the `pr-media` branch; this skill puts the file there. CI fails a
PR that has no image.

## Steps

1. **Pick the flow.** Read the phase's acceptance criteria and choose the one flow that best
   shows the phase to someone who has not read the code. Keep it under about 20 seconds.
2. **Make sure a Playwright test drives that flow** in `e2e/`. If none does, write one: it
   is both the demo and a regression test. Add short pauses only if the result would
   otherwise flash by too fast to read.
3. **Record.** Run only that test: `npx playwright test e2e/<file>.spec.ts`. Recording is
   always on; the video lands in `test-results/<test-name>/video.webm`.
4. **Publish.** `bash .claude/skills/pr-demo/make-demo.sh <phase-number> <path-to-video>`
   converts it to a GIF and pushes it to `pr-media`.
5. **Look at it.** Open the generated GIF and confirm it shows the flow working. A GIF of a
   blank or error page is a failed demo: fix and re-record.

## Phases with nothing visual

For a backend-only or tooling phase, capture a screenshot of the most telling evidence (API
response in the browser, a passing test run) and pass the `.png` to `make-demo.sh` instead.

## If the PR is already open

After publishing, check the PR body contains the image. If not, add a `## Demo` section
with the printed URL using `gh pr edit <number> --body-file <file>`.
