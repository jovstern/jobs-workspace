---
phase: 01-real-ai-path-end-to-end
plan: 05
subsystem: ui
tags: [seed-data, jobs, react, tailwind, tanstack-query, stand-in-model, synthetic-resume]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-02 job schema, seed accessors, stand-in model; 01-03 FitPanel, jobs query, fit store; 01-04 contact removal"
provides:
  - "Nine hand-written software seed jobs with pinned job ids and requirement ids, validated with the shared job schema at module load"
  - "Synthetic demo resume fixture: near-perfect fit for job-frontend-senior, poor fit for job-data-scientist-senior, with fictional contact details"
  - "Shared presentational Card, Button (primary, secondary, destructive, link) and Notice"
  - "Stub page: header, resume card, job list with loading, error, empty and populated states, job detail with Required and Nice to have lists above the fit panel"
  - "renderWithQuery test helper"
affects: [01-06, 01-07, 01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 16800
  tasks: 2
  commits: 4
plan_head_before: 6ede4218e177f901db9fbb2d8340aeec63d2e486
plan_head_after: 26a9570534202f6137528b73f5739cfb01ba9844

tech-stack:
  added: []
  patterns:
    - "Seed data in seed-jobs.ts without a content version; seed.ts computes it and validates every job with jobSchema when the module loads"
    - "Repeated chrome classes (surface, button, notice tones) live only in src/components/{Card,Button,Notice}.tsx"
    - "Unavailable actions use aria-disabled styling in Button, never the native disabled attribute"
    - "One component per file: JobRow exists so each row can call useIsCheckingFit for its own job"

key-files:
  created:
    - server/src/jobs/seed-jobs.ts
    - server/src/jobs/seed.test.ts
    - e2e/fixtures/resumes/frontend-senior.txt
    - src/components/Card.tsx
    - src/components/Button.tsx
    - src/components/Notice.tsx
    - src/features/jobs-stub/JobRow.tsx
    - src/features/jobs-stub/JobDetail.tsx
    - src/features/jobs-stub/JobDetail.test.tsx
    - src/features/jobs-stub/JobPicker.test.tsx
    - src/test/render.tsx
    - .planning/phases/01-real-ai-path-end-to-end/deferred-items.md
  modified:
    - server/src/jobs/seed.ts
    - src/features/jobs-stub/JobPicker.tsx
    - src/App.tsx

key-decisions:
  - "job-frontend-senior was moved to seed-jobs.ts unchanged; its content version 14714af0fe5ddc87 is pinned as a literal in seed.test.ts"
  - "JobRow.tsx added as a tenth new file (not in the plan's file list) so the one-component-per-file rule holds and each row can ask whether its own fit check is running"
  - "FitPanel was left untouched (plan 01-10 owns it), so the selected job's title shows in two level-2 headings until then"

requirements-completed: [FIT-01]

coverage:
  - id: D1
    description: "Nine seed jobs with pinned ids, 6 to 10 requirements each (5 to 7 required, 1 to 4 nice to have), skills from the vocabulary, served by GET /api/jobs"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "server/src/jobs/seed.test.ts#seed jobs"
        status: pass
      - kind: integration
        ref: "server/src/jobs/seed.test.ts#GET /api/jobs returns the nine seed jobs"
        status: pass
    human_judgment: false
  - id: D2
    description: "job-frontend-senior keeps its requirement ids and content version; content version is stable and changes with requirement text"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "server/src/jobs/seed.test.ts#job-frontend-senior keeps its content version from before this plan"
        status: pass
    human_judgment: false
  - id: D3
    description: "Demo resume is 500 to 800 words with only fictional contact details and gives a near-perfect and a poor result through the real SDK path and the stand-in model"
    requirement: FIT-01
    verification:
      - kind: integration
        ref: "server/src/jobs/seed.test.ts#demo pairs through the real SDK path and the stand-in model"
        status: pass
      - kind: unit
        ref: "server/src/jobs/seed.test.ts#the synthetic demo resume"
        status: pass
    human_judgment: false
  - id: D4
    description: "Job list covers loading, failure with Try again, empty and nine-row states; rows show title and company, level and location, aria-current, Checking fit"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "src/features/jobs-stub/JobPicker.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Job detail shows the posting with Required and Nice to have lists above the fit panel; with no job selected the page asks the user to select one; landmarks are one header, one main and labelled sections"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "src/features/jobs-stub/JobDetail.test.tsx"
        status: pass
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: enter resume, check fit, refresh keeps the result"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 100-character job title wraps inside its row at 1024px and 768px with no horizontal scroll"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "src/features/jobs-stub/JobPicker.test.tsx#lets a long title wrap instead of cutting it off"
        status: pass
    human_judgment: true
    rationale: "The unit test proves the title carries break-words and not truncate; the plan's backstop is a visual check at 1024px and 768px, which was not run in a browser here"

duration: 34min
completed: 2026-10-11
---

# Phase 01 Plan 05: Seed jobs, demo resume and stub page Summary

**Nine hand-written fictional software jobs (junior to staff, plus an engineering manager) with pinned job and requirement ids, a synthetic demo resume that is a near-perfect fit for the senior frontend job and a poor fit for the senior data scientist job, and a tidy stub page with a job list, job detail and shared Card, Button and Notice.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-11T07:27:32Z
- **Completed:** 2026-10-11T08:01:33Z
- **Tasks:** 2 (both TDD)
- **Files:** 12 created, 3 modified

## Accomplishments

- `server/src/jobs/seed-jobs.ts` holds the nine jobs. `seed.ts` imports them, computes each content version and validates each with `jobSchema` when the module loads, so a job with no requirements stops the server from starting. `job-frontend-senior` is byte for byte what it was; its content version `14714af0fe5ddc87` is pinned in the test.
- Every job id and all 71 requirement ids are pinned as literals in `seed.test.ts`, together with counts (6 to 10 requirements, 5 to 7 required, 1 to 4 nice to have), vocabulary membership and posting order.
- `e2e/fixtures/resumes/frontend-senior.txt` (695 words) has exactly one email at `example.com`, one `+1 555 0142` phone number, one street address and one link, confirmed with the shared `redactContactDetails` counts. It evidences React, TypeScript, accessibility, testing, performance, design systems and GraphQL, and gives no mentoring evidence, so the near-perfect pair is not a flat 100 percent. Both demo pairs run through `createGeminiClient` and the stand-in model: all six required requirements of `job-frontend-senior` are met; `job-data-scientist-senior` has at most one met.
- Stub page per the UI contract: `bg-gray-50` page, `max-w-5xl` container, `header` with the h1 and subtitle, `main` with the resume card and a `lg:grid-cols-[20rem_1fr]` grid (one column below `lg`, jobs first, rows as a two-column grid between 768 and 1023px). The job list and the detail pane each render as a labelled `section` Card.
- `Button` has the four variants, `min-h-11` on solid ones and `aria-disabled` styling; `Notice` accepts only `status` and `alert`; `Card` is the one surface. The Phase 1 copy for loading, failure, empty and "Select a job" is verbatim.

## Task Commits

1. **Task 1: Author the nine seed jobs and the synthetic demo resume together**
   - RED `25e2e49` (test): 14 tests; 7 failed. Four failed on assertions (job ids, requirement ids, level coverage, `GET /api/jobs`), three on the missing demo resume fixture (read inside each test, so they fail as tests rather than as a collection error). The 7 that passed were the ones the unchanged `job-frontend-senior` already satisfied.
   - GREEN `a8ce3e4` (feat): seed data, seed loader and demo resume; 14 pass, server check passes (54 tests)
2. **Task 2: Build the stub page**
   - RED `32a61ea` (test): `JobPicker.test.tsx` and `renderWithQuery`; 5 of 7 failed on their assertions against the tracer picker. `JobDetail.test.tsx` was written in the same step but cannot pass a project-wide typecheck while `JobDetail` does not exist, so it was held back from the RED commit and committed with the GREEN commit. Its RED evidence is an unresolved-import failure, not an assertion failure.
   - GREEN `26a9570` (feat): components, `JobRow`, `JobDetail`, new `App`; 116 root unit tests pass

**Plan metadata:** committed separately with this summary (docs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `JobRow.tsx`**
- **Found during:** Task 2
- **Issue:** Each row must show `Checking fit` for its own job, which needs `useIsCheckingFit(job.id)` per row. A hook cannot be called inside a `map`, and the stack rule is one component per file.
- **Fix:** New `src/features/jobs-stub/JobRow.tsx` holding one row.
- **Files modified:** `src/features/jobs-stub/JobRow.tsx` (new), `JobPicker.tsx`
- **Commit:** `26a9570`

**2. [Rule 1 - Bug] Test file lint errors**
- **Found during:** Task 1 and Task 2 RED commits
- **Issue:** `as` casts in my own tests were rejected by `non-nullable-type-assertion-style`, and the stack rules forbid `!`.
- **Fix:** Replaced the casts with `map` over the requirements and an explicit `undefined` check.
- **Commits:** `25e2e49`, `32a61ea`

**3. [Rule 3 - Blocking] RED commit without `JobDetail.test.tsx`**
- **Found during:** Task 2 RED
- **Issue:** The pre-commit typecheck covers the whole project, so a test importing a file that does not exist yet blocks the commit.
- **Fix:** Committed `JobPicker.test.tsx` and `render.tsx` as RED, and `JobDetail.test.tsx` with the GREEN commit.

**Total deviations:** 3 auto-fixed (1 added file, 2 process/test fixes). **Impact:** none on scope or behaviour.

### Known limitation (not a deviation)

`FitPanel.tsx` is outside this plan's file list and plan 01-10 rewrites it. It still renders its own `section` and a level-2 heading with the job title, so the title appears twice in the detail pane and the pane holds a fourth `section`. The acceptance line "three `section` elements" therefore holds for the page-level regions (resume, jobs, detail) but not as a literal count of `section` elements in the DOM while a job is selected. Logged in `deferred-items.md`; the test asserts the posting's heading is the first level-2 heading with that title.

## Issues Encountered

None blocking.

## Known Stubs

None. The resume textarea and "Use this text" button are the temporary controls named in the plan; plan 01-08 replaces them.

## Threat Flags

None. No new endpoint, auth path or storage. T-01-17 (ids pinned by test, content version computed and served) and T-01-18 (synthetic persona, `example.com` and `555 01xx` asserted by a test, fictional companies) are implemented. T-01-19: job text is rendered as React text nodes; no `dangerouslySetInnerHTML`.

## Verification Run

- `npm --prefix server run test -- src/jobs/seed.test.ts`: 14 passed
- `npm --prefix server run check`: passed (lint, typecheck, 54 tests)
- `npm run check`: passed (format, lint, typecheck, 116 tests, build)
- `npx playwright test e2e/check-fit.spec.ts`: 1 passed, spec unchanged
- `npm run e2e`: 1 passed; nothing left listening on 4173, 3101 or 3199
- Acceptance greps: no `useMemo`, `useCallback` or `memo` under `src/`; `Button.tsx` has `min-h-11` and the four variants; no step `3`, `5` or `.5` in any file this plan wrote (the pre-existing `GreetingForm.tsx` has two, logged as deferred)
- Not run: the visual backstop for a 100-character title at 1024px and 768px (see D6)

## Next Phase Readiness

Plan 01-06 and later can rely on nine served jobs, the demo resume fixture for browser tests, and the shared Card, Button and Notice. Plan 01-10 should replace the tracer `FitPanel` heading and section.

## Self-Check: PASSED

- Files exist: `server/src/jobs/seed-jobs.ts`, `server/src/jobs/seed.test.ts`, `e2e/fixtures/resumes/frontend-senior.txt`, `src/components/Card.tsx`, `src/components/Button.tsx`, `src/components/Notice.tsx`, `src/features/jobs-stub/JobRow.tsx`, `src/features/jobs-stub/JobDetail.tsx`, `src/features/jobs-stub/JobDetail.test.tsx`, `src/features/jobs-stub/JobPicker.test.tsx`, `src/test/render.tsx` (checked below)
- Commits `25e2e49`, `a8ce3e4`, `32a61ea`, `26a9570` are ancestors of HEAD (checked below)
