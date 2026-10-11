---
phase: 01-real-ai-path-end-to-end
plan: 11
subsystem: ui
tags: [privacy, react, tanstack-query, playwright, vitest, secrets]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-05 job detail and picker; 01-08 resume card; 01-03 FitPanel unavailableReason prop and GET /api/health; 01-10 fit result panel"
provides:
  - "PrivacyNote: the approved four-paragraph note, always visible in the resume card, with the paid-tier paragraph behind one module-local constant"
  - "healthQueryOptions (query key ['health']) and the AI-status notice in JobDetail, wired to FitPanel's unavailableReason"
  - "server/.env.example with variable names only"
  - "e2e/no-secrets.spec.ts: scans every loaded document, script, stylesheet and API response for key material"
affects: [01.1, 01.2]

actuals:
  tokens: 12000
  tasks: 3
  commits: 2
plan_head_before: b98b315c898bffe44a7bef835d04fc379b5db4fb
plan_head_after: dd7c5b9752f3cc81e312ed1d3bb06951da598bc7

tech-stack:
  added: []
  patterns:
    - "A claim that depends on an outside fact is one module-local constant with a dated decision comment; the component takes it as a defaulted prop so tests cover both branches"
    - "The AI status is a free local query (GET /api/health), read where it matters; loading shows nothing and blocks nothing, failure and not-configured each give a notice plus the same reason on the button"

key-files:
  created:
    - src/features/resume/PrivacyNote.tsx
    - src/features/resume/PrivacyNote.test.tsx
    - server/.env.example
    - e2e/no-secrets.spec.ts
  modified:
    - src/features/resume/ResumeCard.tsx
    - src/features/resume/ResumeCard.test.tsx
    - src/features/jobs-stub/queries.ts
    - src/features/jobs-stub/JobDetail.tsx
    - src/features/jobs-stub/JobDetail.test.tsx

key-decisions:
  - "Task 1 decision billing-confirmed (user, 2026-10-11): the privacy note ships with all four paragraphs; the user owns keeping the paid-tier sentence true. PAID_TIER_CONFIRMED in PrivacyNote.tsx records it and must be set to false if billing on the key's project lapses"
  - "Health failure of any kind (network, bad status, unparsable body) shows the same 'Can't reach the app server' notice; the fit button stays usable while health is loading"

patterns-established:
  - "Key-material scan: response bodies collected with page.on('response'), a vacuity guard asserting document, script, stylesheet and fetch were all seen, then the same scan on /api/health and /api/jobs through the request fixture"

requirements-completed: [DATA-06, DATA-07]

duration: 25 min
completed: 2026-10-11
---

# Phase 1 Plan 11: Privacy note, AI status and key-leak scan Summary

**The resume card always shows the approved four-paragraph note on where the resume goes (paid-tier paragraph included, on the user's billing confirmation), the job detail says up front when AI is not set up or the server is unreachable, and a browser test proves no key material reaches the page.**

## Accomplishments

- `PrivacyNote` (`h2` "How your resume is used", Body text, no accent colour) with the four paragraphs word for word. The paid-tier paragraph is controlled by `PAID_TIER_CONFIRMED`, set to true with a comment naming the option (`billing-confirmed`) and the date. Rendered in `ResumeCard` in both states, never inside a collapsed element. Tests match each paragraph as a full string for both prop values and the default, and check both card states.
- `healthQueryOptions` and a `role="status"` neutral `Notice` above the posting. `aiConfigured: false` shows the full set-up sentence and describes the aria-disabled `Check my fit` button with `AI is not set up.`; a failed health request shows `Can't reach the app server (is it running?)` and describes the button with it; configured or loading shows nothing and leaves the button available. `FitPanel` is unchanged.
- `server/.env.example`: a comment, `GEMINI_API_KEY=` with no value, a commented `PORT=3001`. Written from the names in `server/src/config/env.ts`; `server/.env` was never opened.
- `e2e/no-secrets.spec.ts`: no document, script, stylesheet or fetch body matches `AIza` + 35 key characters, contains `ci-fake-key` or `VITE_GEMINI`; same for `/api/health` and `/api/jobs`; and the template line is empty. The test asserts that all four resource types were actually scanned, so it cannot pass vacuously.

## Verification

- `npm run check`: format, lint, typecheck, 200 unit tests (was 190), build all pass.
- `npm run e2e`: 7 passed (5 before plus the 2 new). Stand-in model only; nothing ran with `REAL_AI=1` and no request went to Google.
- Plant check (acceptance criterion): appending `console.log('ci-fake-key')` to `src/main.tsx` made `no-secrets.spec.ts` fail with "key material in the response from .../assets/index-*.js"; the file was restored and is unchanged in the commit.
- 768px backstop: measured at a 768px viewport, the card (718px) and the note (670px) have `scrollWidth` equal to `clientWidth`, so nothing clips or overflows; the page is 768px wide with no horizontal scroll. This was a measurement, not a visual review; a human glance at the note at 768px is still worthwhile.
- Acceptance greps: no `process.env` or `VITE_GEMINI` under `src/` or `shared/src/`; `git ls-files server/.env.example` is non-empty, `server/.env` is untracked; `FitPanel.tsx` has no diff.
- Server package (`npm --prefix server run check`) was not re-run: no server code changed in this plan.

## Human check pending

**The real-model run is pending and has not been done by this agent.** Per the plan, only the user runs it (or authorises it at that moment): `REAL_AI=1 npx playwright test e2e/check-fit.spec.ts -g "main flow"`, then watch the recording in `test-results/`. It uses only the synthetic `e2e/fixtures/resumes/frontend-senior.txt`. Expected: placeholders for the four contact details, a rating and quote per requirement, a score with an estimate band, and the same result after reload with no second fit request. Cost is a few US cents. **It is currently blocked:** Google refuses the user's key with HTTP 403 PERMISSION_DENIED (the open 01-09 spike), so the run would fail until the key is accepted. Without a go-ahead the pull request demo is recorded against the stand-in model.

## Deviations from Plan

None - plan executed exactly as written. Notes that are not deviations:

- **One commit per task, not RED/GREEN pairs.** The plan is `type: execute` and `workflow.tdd_mode` is off, so the tests were written and seen failing first (the `ResumeCard` and `JobDetail` cases on their assertions, `PrivacyNote.test.tsx` on the missing module) but each task is a single commit; the pre-commit hook runs typecheck and lint, which a failing-import test commit would not pass. Commits: `8f09a75` (Task 2), `dd7c5b9` (Task 3). Task 1 was the decision checkpoint and has no commit.
- **Existing `JobDetail` tests now route the stubbed `fetch` by URL** so `/api/health` answers `aiConfigured: true`; before, every URL returned the jobs payload, which would now read as a failed health check.
- **Wrapper element.** `JobDetail` now returns a `div` holding the notice and the card so the notice sits above the posting; the card, its landmark and its heading are unchanged.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Authentication Gates

None.

## Issues Encountered

None. One scripted edit to `JobDetail.test.tsx` mangled the file (a bad slice offset); it was restored from git before any test ran on it and redone with plain edits.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or storage; `GET /api/health` already existed and the page now reads it. T-01-39 is covered by the new scan, T-01-40 by the decision plus the constant and both-branch tests, T-01-42 by using only the committed synthetic fixture (no real-model run was made).

## Next Phase Readiness

Plan 01-11 is the last plan of phase 1 apart from the open 01-09 live spike. The phase's remaining items are the key being accepted by Google (403 PERMISSION_DENIED), the human real-model run above, and the demo GIF (`pr-demo`).

## Self-Check: PASSED

- Files exist: PrivacyNote.tsx, PrivacyNote.test.tsx, server/.env.example, e2e/no-secrets.spec.ts, and the modified files.
- Commits `8f09a75` and `dd7c5b9` are ancestors of HEAD.
