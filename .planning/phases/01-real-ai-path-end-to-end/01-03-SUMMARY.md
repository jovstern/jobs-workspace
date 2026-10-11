---
phase: 01-real-ai-path-end-to-end
plan: 03
subsystem: ui
tags: [react, tanstack-query, zustand, playwright, express, stand-in-model, tracer]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-02 shared contracts, POST /api/fit, seed job, fake-gemini stand-in"
provides:
  - "Server started for real: loadServerEnv, Gemini client only when a key is set, GET /api/jobs, aiConfigured in /api/health"
  - "Browser half of the tracer: enter resume text, pick the seed job, Check my fit, see a rating per requirement with quotes"
  - "Persisted analyses store (localStorage jw:analyses, version 1, one entry per job, Zod-validated on load)"
  - "Playwright harness with its own stand-in model (3199) and API (3101), REAL_AI switch, no key needed"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 18000
  tasks: 2
  commits: 3
plan_head_before: 25c7dc457547bc1ab235f7965fb747ebec714352
plan_head_after: d057a66b398cc73ceef6ff8061ac804ce439714d

tech-stack:
  added: []
  patterns:
    - "apiRequest: the one fetch wrapper; parses every 2xx body and every error envelope with shared schemas; network failure or timeout becomes ApiError server_unreachable"
    - "Paid call as useMutation: retry false, networkMode always, store write in the hook-level onSuccess using variables captured at click time"
    - "useIsCheckingFit over useMutationState blocks a second click on the same job"
    - "FitPanel keyed by job id so mutation error state never leaks between jobs"
    - "Playwright webServer array: stand-in model, API on 3101, preview on 4173, none reusing a running server"

key-files:
  created:
    - server/src/jobs/routes.ts
    - src/lib/api.ts
    - src/features/jobs-stub/queries.ts
    - src/features/jobs-stub/JobPicker.tsx
    - src/features/fit-analysis/fit-store.ts
    - src/features/fit-analysis/fit-store.test.ts
    - src/features/fit-analysis/mutations.ts
    - src/features/fit-analysis/FitPanel.tsx
    - src/features/fit-analysis/FitPanel.test.tsx
    - e2e/check-fit.spec.ts
  modified:
    - server/src/app.ts
    - server/src/app.test.ts
    - server/src/index.ts
    - src/App.tsx
    - playwright.config.ts
  deleted:
    - e2e/smoke.spec.ts

key-decisions:
  - "The browser-test preview server also uses reuseExistingServer false (the plan named it only for the stand-in and the API), because a preview left running earlier could proxy to a developer's API and defeat T-01-09"
  - "FitPanel shows the server's own error message for ApiError (fixed per code, so the common ai_failed case is the plan's exact text, and ai_not_configured and server_unreachable are more useful); the Try again button is hidden for non-retryable errors"
  - "The temporary resume field is a plain textarea and button, not a TanStack Form, as the plan specified; plan 01-08 replaces it with the paste form"

requirements-completed: [FIT-01, FIT-08, DATA-01, DATA-07]

coverage:
  - id: D1
    description: "GET /api/health reports aiConfigured for an app with and without an AI client; GET /api/jobs serves the seed jobs through the shared schema; unknown routes answer the shared envelope"
    requirement: DATA-07
    verification:
      - kind: integration
        ref: "server/src/app.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "User enters resume text, picks the seed job, clicks Check my fit and sees 8 rated requirements with resume quotes for met ratings"
    requirement: FIT-01
    verification:
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: enter resume, check fit, refresh keeps the result"
        status: pass
    human_judgment: false
  - id: D3
    description: "After a refresh the stored ratings show again and no second /api/fit request is sent"
    requirement: FIT-08
    verification:
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: enter resume, check fit, refresh keeps the result"
        status: pass
      - kind: unit
        ref: "src/features/fit-analysis/FitPanel.test.tsx#a stored analysis is shown at once and sends no request"
        status: pass
    human_judgment: false
  - id: D4
    description: "An AI request starts only from an explicit click: rendering, a disabled button and a failed check send no request"
    requirement: DATA-07
    verification:
      - kind: unit
        ref: "src/features/fit-analysis/FitPanel.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyses store hydrates a valid value, ignores a wrong-shape or unparseable one, and persists under jw:analyses version 1"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/features/fit-analysis/fit-store.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-11
---

# Phase 1 Plan 03: Check my fit in the browser Summary

**The walking skeleton now runs browser to model and back: enter resume text, pick the seed job, click Check my fit and see eight ratings with resume quotes, stored under `jw:analyses` and shown again after a refresh with no second `/api/fit` request; `npm run e2e` runs it against a stand-in model on its own ports with no key.**

## Accomplishments

- Task 1 (TDD): `app.test.ts` rewritten first and run red (health lacked `aiConfigured`, `/api/jobs` was 404), committed, then green. `server/src/jobs/routes.ts` serves `{ jobs }`; `app.ts` uses the shared health type and reports `aiConfigured: ai !== null`; `index.ts` calls `loadServerEnv()`, builds the Gemini client only when a key exists, binds `127.0.0.1` and prints one start line (URL and `AI configured: yes|no`, no env values).
- Task 2 (tracer): `apiRequest`/`ApiError`, `jobsQueryOptions`, `JobPicker`, `useFitStore`, `useCheckFit`/`useIsCheckingFit`, `FitPanel`, the temporary `App`, the Playwright webServer array and `e2e/check-fit.spec.ts`. The greeting form is no longer rendered (its files remain until plan 01-08); `e2e/smoke.spec.ts` is deleted.
- Added unit tests beyond the plan list because quality-gates requires a test per behaviour: `FitPanel.test.tsx` (no request on render, disabled without a resume, one request per click, stored result needs no request, failure shows the alert with no automatic retry) and `fit-store.test.ts` (valid hydrate, wrong shape, unparseable text, replace-per-job persistence).
- Tracer feedback gate: interactive mode, `end-of-phase`, automated-only `<verify>`: both verify commands re-run after the final change and passed. "Tracer verified end-to-end"; no expansion task follows.

## Verification

- `npm --prefix server run test -- src/app.test.ts`: 6 passed (red before the feature commit: 3 failed).
- `npm --prefix server run check`: lint, typecheck, 23 tests pass.
- `npm run check`: format, lint, typecheck, 14 unit tests, build pass.
- `env -u GEMINI_API_KEY npm run e2e`: 1 passed, with no key in the shell. Ports 3101, 3199 and 4173 were free afterwards.
- Acceptance greps: `retry: false` and `networkMode: 'always'` in `mutations.ts`; `reuseExistingServer: false` on all three webServer entries; ports 3101, 3199 and `REAL_AI` in `playwright.config.ts`; no `@google/genai` or `VITE_` under `src/`; `App.tsx` imports nothing from `features/greeting`; `e2e/smoke.spec.ts` gone. The `jw:analyses` shape (`version: 1`, `advice: null`, 64-character `resumeHash`) is asserted inside the e2e test.
- Not run: the dev-server manual smoke (optional) and any real-model run; nothing was sent to Google.

## Task Commits

| Task | Commit | Notes |
|---|---|---|
| 1 RED | 05feb72 | failing health and jobs tests |
| 1 GREEN | 52c3091 | jobs route, health AI status, real env wiring |
| 2 | d057a66 | tracer: browser flow, store, mutation, Playwright harness, e2e test |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Preview server also never reused**
- **Found during:** Task 2
- **Issue:** The plan keeps the client entry as it was (`reuseExistingServer: !isCI`). A `vite preview` left running on 4173 would proxy to whatever `API_PROXY_TARGET` it started with, possibly the developer's API with the real key, which defeats T-01-09.
- **Fix:** `reuseExistingServer: false` on the client entry as well. A busy 4173 now makes Playwright fail with a clear port-in-use error instead of silently reusing it.
- **Files modified:** playwright.config.ts
- **Commit:** d057a66

**2. [Rule 2 - Missing critical] Component and store unit tests**
- **Found during:** Task 2
- **Issue:** The plan named only the e2e test; the prohibition on implicit AI requests is marked `verification: test` and quality-gates requires a test per behaviour.
- **Fix:** `FitPanel.test.tsx` and `fit-store.test.ts` (see Accomplishments).
- **Commit:** d057a66

**Total deviations:** 2 auto-fixed (both Rule 2). **Impact:** none on scope; one stricter harness setting and two extra test files.

Not done, noted for the verifier: `src/lib/query-client.ts` does not get `mutations: { retry: false }` (research D.2 suggested it, the plan's file list does not include it). The only mutation sets `retry: false` itself.

## Issues Encountered

An early e2e run failed with "Could not load jobs" because `playwright.config.ts` had not yet been changed (a chained shell command stopped before the write), so no API was running. Fixed by writing the config; no code change was needed.

## Known Stubs

- `src/App.tsx` resume field and `src/features/jobs-stub/`: intentional temporary page; the layout arrives in plan 01-05 and the paste form in plan 01-08.
- `FitPanel` shows a stored analysis regardless of the current resume hash; matching and the stale marker are plan 01-10 and Phase 01.2 (documented in the plan).
- Corrupt stored data is ignored, not set aside or reported (DATA-02, Phase 01.1; documented in the plan).

## Threat Flags

None. New surface is the same-origin `/api/jobs` read (seed data only) and the localStorage entry already covered by T-01-11. Mitigations in place: T-01-09 (own ports, no reuse, fake key and base URL in the webServer env), T-01-10 (retry off, networkMode always, click-only start, in-flight guard, request count asserted in e2e), T-01-11 (Zod validation in `merge`, model text rendered as text), T-01-12 (client calls only `/api`, no SDK or `VITE_` key under `src/`).

## Next Phase Readiness

Ready for 01-04. FitPanel props, the store, the mutation variables and `apiRequest` are as locked in the plan's interfaces.

## Self-Check: PASSED

- FOUND: server/src/jobs/routes.ts, src/lib/api.ts, src/features/jobs-stub/queries.ts, src/features/jobs-stub/JobPicker.tsx, src/features/fit-analysis/fit-store.ts, src/features/fit-analysis/mutations.ts, src/features/fit-analysis/FitPanel.tsx, e2e/check-fit.spec.ts; e2e/smoke.spec.ts absent as planned
- FOUND commits: 05feb72, 52c3091, d057a66
