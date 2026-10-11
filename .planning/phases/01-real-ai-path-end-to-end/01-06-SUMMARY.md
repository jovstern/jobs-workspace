---
phase: 01-real-ai-path-end-to-end
plan: 06
subsystem: api
tags: [express, logging, origin-guard, rate-limit, security, privacy]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-03 createApp with injected ai, now, log; AppError and the central error handler; fit route"
provides:
  - "requestLog: one metadata-only line per request, `METHOD path status <n>ms`, query string removed"
  - "localOrigin: loopback Host, allow-listed Origin, no cross-site Sec-Fetch-Site, JSON-only state-changing requests; sets no header, no CORS"
  - "createRateLimiter: hand-written fixed-window limiter (default 20 per 60000 ms, per client address) with Retry-After in whole seconds"
  - "createApp order: request log, origin guard, routes (limiter ahead of the fit router), not-found handler, error handler"
  - "createApp dependency rateLimit; the running server always passes 20 per 60000 ms"
affects: [01-07, 01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 7100
  tasks: 3
  commits: 6
plan_head_before: 95a321f998218ed4bc660c90b7982b7493c87706
plan_head_after: e7725c5075c7fadf703c284a0077863921352508

tech-stack:
  added: []
  patterns:
    - "Each guard is its own middleware module in server/src/http/ that throws AppError, so the central handler shapes every refusal"
    - "Middleware tests call the guard through a tiny Express app on a real port with node:http, or call the handler directly with a fake request and an injected clock; nothing sleeps"
    - "A privacy rule is proven with marker strings: ZEBRA-MARKER-7731 in the resume and MODEL-MARKER-5512 in the model answer must not appear in any log line or console call"

key-files:
  created:
    - server/src/http/request-log.ts
    - server/src/http/request-log.test.ts
    - server/src/http/errors.test.ts
    - server/src/http/local-origin.ts
    - server/src/http/local-origin.test.ts
    - server/src/http/rate-limit.ts
    - server/src/http/rate-limit.test.ts
  modified:
    - server/src/app.ts
    - server/src/app.test.ts
    - server/src/fit/routes.test.ts
    - server/src/index.ts

key-decisions:
  - "The rate limiter is hand-written with no dependency (D-19); server/package.json is unchanged"
  - "createApp defaults: no logger means a silent no-op (tests stay quiet; index.ts passes a console logger), no env means parseEnv({}) so the default allowed origins apply"
  - "The content-type rule applies to every method except GET, HEAD and OPTIONS, not only POST, so a future PUT or DELETE route is covered without a change"
  - "The origin guard runs before the limiter, so a refused foreign request never uses up the user's quota"

requirements-completed: [DATA-06, DATA-07]

coverage:
  - id: D1
    description: "Request log carries method, path, status and duration only; neither the resume text nor the model output reaches a log line or a console call"
    requirement: DATA-06
    verification:
      - kind: unit
        ref: "server/src/http/request-log.test.ts#no log line and no console call contains the resume text or the model output"
        status: pass
      - kind: unit
        ref: "server/src/http/request-log.test.ts#a successful fit request logs exactly one line: method, path, status, duration"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty body, empty resume text or missing fields answer 400 before any AI call with a metadata-only log line"
    requirement: DATA-06
    verification:
      - kind: unit
        ref: "server/src/http/request-log.test.ts#requests rejected before any AI call"
        status: pass
    human_judgment: false
  - id: D3
    description: "Error bodies never echo internal text; oversized JSON answers 413 and malformed JSON answers 400; no source module writes a file"
    requirement: DATA-06
    verification:
      - kind: unit
        ref: "server/src/http/errors.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Other origins, rebinding hosts, cross-site fetches and non-JSON posts are refused before any AI call; no CORS header is ever sent"
    requirement: DATA-07
    verification:
      - kind: unit
        ref: "server/src/http/local-origin.test.ts"
        status: pass
      - kind: integration
        ref: "server/src/app.test.ts#a fit request from another origin answers 403 and the model is not called"
        status: pass
    human_judgment: false
  - id: D5
    description: "More than 20 fit requests a minute from one client answer 429 with Retry-After; health and jobs are never limited; the real page still works through the proxy"
    requirement: DATA-07
    verification:
      - kind: unit
        ref: "server/src/http/rate-limit.test.ts"
        status: pass
      - kind: integration
        ref: "server/src/app.test.ts#with rateLimit max 2 the third fit request answers 429 and the model was called twice"
        status: pass
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: enter resume, check fit, refresh keeps the result"
        status: pass
    human_judgment: false

duration: 6 min
completed: 2026-10-11
---

# Phase 1 Plan 06: Server request guards Summary

**Metadata-only request log, a loopback and origin guard with no CORS, and a hand-written 20-per-minute limiter on the fit route, wired into createApp in a fixed order with no new dependency.**

## Performance

- **Duration:** 6 min (start 2026-10-11T08:02Z, end 2026-10-11T08:08Z)
- **Tasks:** 3 of 3
- **Files:** 7 created, 4 modified

## Accomplishments

- `requestLog` writes one line per request, `POST /api/fit 200 12ms`, built only from the method, the path without its query string, the status code and the elapsed time. It never touches the body or the headers, and the marker-string test shows no log line or `console` call carries the resume or the model answer.
- `localOrigin` refuses a non-loopback `Host` (DNS rebinding), an `Origin` outside `env.allowedOrigins` (exact match), `Sec-Fetch-Site: cross-site`, and any state-changing request that is not `application/json`. It sets no response header. The app-level test shows a foreign-origin fit request gets 403 with zero model calls.
- `createRateLimiter` is a fixed-window limiter keyed by address, state in a closure `Map` (address, count, window start only), swept of ended windows once more than 1000 clients are tracked. It answers 429 `too_many_requests` with `Retry-After` rounded up to whole seconds. Defaults are 60000 ms and 20 requests; `index.ts` passes exactly that, so the server used by dev, the browser tests and the demo is always limited.
- `createApp` now registers, in order: request log, origin guard, routes (limiter mounted on `/api/fit` ahead of the body parser, only when `rateLimit` is given), not-found handler, error handler.
- Error-body safety and statelessness are pinned by tests: a thrown `Error('secret detail')` answers the generic 500; a body over 256 kB answers 413; malformed JSON answers 400; a source walk finds no `writeFile`, `appendFile` or `createWriteStream` outside tests, `scripts` and `test-support`.

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| 1 RED | d12135e | test | Failing tests for the request log and safe error bodies |
| 1 GREEN | 5546352 | feat | `requestLog`, wired first in `createApp`, console logger in `index.ts` |
| 2 RED | e09f93b | test | Failing tests for the local origin guard (with a pass-through placeholder) |
| 2 GREEN | fe0a7e0 | feat | `localOrigin` |
| 3 RED | c459ba6 | test | Failing limiter and app tests (with a placeholder limiter and the `rateLimit` type) |
| 3 GREEN | e7725c5 | feat | `createRateLimiter`, final wiring, `rateLimit` in `index.ts` |

## Files Created/Modified

- Created: `server/src/http/request-log.ts`, `request-log.test.ts`, `errors.test.ts`, `local-origin.ts`, `local-origin.test.ts`, `rate-limit.ts`, `rate-limit.test.ts`
- Modified: `server/src/app.ts`, `server/src/app.test.ts`, `server/src/fit/routes.test.ts`, `server/src/index.ts`

## Decisions Made

- No dependency was added (D-19). `server/package.json` is unchanged and does not list `express-rate-limit`.
- Quiet-by-default `log` and `parseEnv({})` as the default `env` in `createApp`, so the existing tests that build an app with no dependencies keep passing and keep their output clean.
- The content-type rule covers every method except GET, HEAD and OPTIONS.
- The limiter keys on `req.ip`. Behind the Vite proxy every browser request arrives from `127.0.0.1`, so for the one local user the limit is effectively per running server, which is the intent.

## TDD Gate Compliance

Each task has a `test(01-06)` commit before its `feat(01-06)` commit.

- **Task 1 RED:** the target tests in `request-log.test.ts` failed on `expect(harness.lines).toHaveLength(1)` (received 0 lines) because the logger was accepted by `createApp` but never called; 5 failed, 5 passed. The marker-string test and `errors.test.ts` passed in RED: they are characterisation tests of behaviour that already existed (generic error body, 413, 400, no file writes), and the marker test is only meaningful once a log line exists, which the sibling length assertions cover. Semantic assessment: the failing tests ran and failed on the planned assertion for the intended reason. `gsd_run check tdd-red-evidence` was not run (no TAP record was captured); the failing output was read directly.
- **Task 2 RED:** 12 of 24 failed on the status and error-code assertions against a pass-through placeholder. The first RED commit attempt was rejected by the pre-commit lint hook (unused parameter in the placeholder), so the placeholder was adjusted and committed once.
- **Task 3 RED:** 6 limiter unit tests, the 429 test, the 403 test, the foreign-origin-does-not-use-quota test and the changed 415 expectation failed on assertions, 10 in total.
- **REFACTOR:** none needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired `requestLog` into `createApp` in Task 1 rather than Task 3**
- **Found during:** Task 1
- **Issue:** The Task 1 tests build an app with `createApp({ ai, log, now })` and read the log lines, so the middleware had to be mounted for them to pass. The plan's wiring step was in Task 3.
- **Fix:** Mounted `requestLog` as the first middleware in Task 1, and passed a console logger from `index.ts`. Task 3 added the rest in the fixed order.
- **Files modified:** `server/src/app.ts`, `server/src/index.ts`
- **Commit:** 5546352

**2. [Rule 1 - Bug in existing test] Non-JSON fit POST now answers 415, not 400**
- **Found during:** Task 3
- **Issue:** `server/src/fit/routes.test.ts` expected 400 for a `text/plain` POST to `/api/fit`. The plan's origin guard refuses it earlier with 415 (`unsupported_media_type`), so the old expectation describes behaviour the plan replaces.
- **Fix:** Changed the expectation to 415 with a comment naming the guard; the "zero model calls" assertion is unchanged. Not a skipped or deleted test.
- **Files modified:** `server/src/fit/routes.test.ts`
- **Commit:** c459ba6

**3. [Rule 2 - Missing testability] Limiter exposes `trackedClients()`**
- **Found during:** Task 3
- **Issue:** The behaviour "entries whose window has ended are removed past 1000 clients" cannot be observed from outside a closure-held `Map`.
- **Fix:** `createRateLimiter` returns the middleware with one read-only `trackedClients()` function attached (a count, no content). It is still an Express middleware; the app never calls the function.
- **Files modified:** `server/src/http/rate-limit.ts`, `server/src/http/rate-limit.test.ts`
- **Commit:** c459ba6, e7725c5

**4. [Rule 3 - Blocking] Placeholders in the RED commits**
- **Found during:** Tasks 2 and 3
- **Issue:** The pre-commit hook type-checks and lints, so a test file that imports a module that does not exist cannot be committed.
- **Fix:** RED commits carry a pass-through `localOrigin`, a pass-through `createRateLimiter` and the `rateLimit` type on `AppDeps`; the GREEN commits replace them. This also kept RED on assertion failures rather than import errors.
- **Commit:** e09f93b, c459ba6

**Total deviations:** 4 auto-fixed (1 bug in an existing test expectation, 1 missing testability hook, 2 blocking ordering issues). **Impact:** none on scope or behaviour; the delivered middleware, order and defaults are the plan's.

## Issues Encountered

None open. Verification run in this session: `npm --prefix server run check` (lint, typecheck, 98 tests) passed; `npm run e2e` passed (1 test) with the guards active; `npm run check` (format, lint, typecheck, unit tests, build) passed. Ports 4173, 3101 and 3199 were free before and after.

## Threat Flags

None. No new endpoint, auth path or file access; the plan's T-01-20 to T-01-24 mitigations are implemented and tested. T-01-SC: no install ran.

## Known Stubs

None.

## Next Phase Readiness

Ready for 01-07. Later plans that add server routes inherit the log, the origin guard and the error handler for free. A new paid route must add its own `app.use(<path>, limiter)` ahead of its router. A browser test that sends POSTs must use `application/json` and an origin in `env.allowedOrigins`; the Vite proxy already does.

## Self-Check: PASSED

- All 7 created files exist on disk.
- Commits d12135e, 5546352, e09f93b, fe0a7e0, c459ba6, e7725c5 are ancestors of HEAD.
- Acceptance criteria re-checked: `request-log.ts` references neither `req.body` nor `req.headers`; `local-origin.ts` sets no header; `server/package.json` unchanged and free of `express-rate-limit`; registration order in `app.ts` is request log, origin guard, routes, not-found, error handler; `index.ts` passes `rateLimit: { windowMs: 60_000, max: 20 }`.
