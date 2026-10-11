---
phase: 01-real-ai-path-end-to-end
plan: 09
subsystem: api
tags: [gemini, live-spike, latency, thinking-level, vitest, diagnostics]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-05 seed jobs and synthetic resume; 01-07 analyzeFit pipeline; 01-02 AiClient and stand-in model"
provides:
  - "spike-live.ts: the live-call spike with --check-config, --dry-run and live modes, a 30 request cap, no retries, numbers-only output"
  - "spike-stats.ts: percentile, countRatingFlips, chooseThinkingLevel, recommendMaxOutputTokens (plus deadline and spend helpers), unit tested"
  - "diagnose.ts and the onFailure hook: a failed model call reports an HTTP status, a fixed category and a fixed class name, never message text"
  - "01-SPIKE-RESULTS.md: the measured latency, tokens, stability and spend of the real fit call"
  - "MODELS.fit set from the measurements: thinking LOW, maxOutputTokens 4096, deadlineMs 30000"
affects: [01.1, 01.2]

requirements-completed: [FIT-01]

actuals:
  tokens: 13300
  tasks: 3
  commits: 6
plan_head_before: 9fa6d09cf724e666d476184645e9f2bdda0ddd55
plan_head_after: 756b84269b5b8ae03d12ffed565f5c7f44a14a73

tech-stack:
  added: []
  patterns:
    - "Paid calls live in a script outside every gate, behind a blocking human go-ahead, with a request cap, no retries and a stop after three failures in a row"
    - "A failure diagnostic is a closed vocabulary: status number, category and class name come from fixed lists, so message text cannot reach it"

key-files:
  created:
    - server/src/scripts/spike-stats.ts
    - server/src/scripts/spike-stats.test.ts
    - server/src/scripts/spike-live.ts
    - server/src/scripts/spike-live.test.ts
    - server/src/ai/diagnose.ts
    - server/src/ai/diagnose.test.ts
    - server/src/ai/client.test.ts
    - .planning/phases/01-real-ai-path-end-to-end/01-SPIKE-RESULTS.md
  modified:
    - server/src/ai/client.ts
    - server/src/fit/analyze.ts
    - server/src/config/models.ts

key-decisions:
  - "LOW thinking is chosen: it is the lowest level and meets every part of the rule (p90 4698 ms, 6/6 required met near-perfect, 0 met poor, 0 flips, no failures); MEDIUM missed the 15 s p90 (16900 ms) and HIGH failed three of six calls at the 60 s spike deadline"
  - "Output cap 4096 and deadline 30000 ms follow from the stated rule (floors apply); the spike did not test them directly, it ran with 16384 and 60000"
  - "The diagnostic is surfaced only in the spike script, not in the server log; the route still answers with ai_failed only"

duration: 256 min
completed: 2026-10-11
---

# Phase 01 Plan 09: Live-call spike and model settings Summary

**The real Gemini model (`gemini-3.8-flash`) answers the fit call at LOW thinking in about 4 s (p90 4.7 s) with correct, repeatable ratings and zero rejected quotes; the output cap and deadline in `MODELS.fit` now come from those measurements.**

## Accomplishments

- Built the spike script with a free dry run against the stand-in model, a check-config mode, and a live mode that refuses without a key or with `GEMINI_BASE_URL` set. A hard cap of 30 requests, no retries, and a stop after three failures in a row. Statistics helpers are unit tested, including the "no level qualifies" case.
- Made the first calls to Google's real model through `analyzeFit`, the same path the route uses, with the committed synthetic resume only. The API accepted the response schema. All 19 answered calls were schema-valid; no short ratings array, no out-of-job id, no `schema_mismatch`.
- Recorded latency, tokens, required-met counts, rating flips, rejected quotes and spend in `01-SPIKE-RESULTS.md`.
- Applied the chosen settings: thinking `LOW` (unchanged), `maxOutputTokens` 8192 to 4096, `deadlineMs` 45000 to 30000.
- Added a status-only failure diagnostic after the first live run failed with no readable cause. It is what exposed the HTTP 403 `PERMISSION_DENIED` key problem in run 2.

## Live runs

| Run | Started by | Requests | Outcome |
|-----|-----------|----------|---------|
| 1 | executor, on the user's first go-ahead | 3 | All refused in under 300 ms; cause hidden by design |
| 2 | orchestrator, after the diagnostic | 3 | HTTP 403 `PERMISSION_DENIED` on all three: a key problem, fixed by the user |
| 3 | orchestrator, on the user's direct instruction | 22 | The measuring run: 19 answered, 3 aborted at the 60 s spike deadline |

Total model requests across all runs: 28. The six refused requests reported no tokens. The measuring run's estimated spend is US$0.1688 (an estimate from published prices, not a bill).

## Measurements at the chosen level

| Level | Calls | Failed | p50 ms | p90 ms | Required met (near-perfect / poor) | Flips | Rejected quotes |
|-------|------:|-------:|-------:|-------:|------------------------------------|------:|----------------:|
| LOW | 10 | 0 | 3688 | 4698 | 6 in all 5 / 0 in all 5 | 0 | 0 |
| MEDIUM | 6 | 0 | 11043 | 16900 | 6 in all 3 / 0 in all 3 | 0 | 0 |
| HIGH | 6 | 3 | 56097 | 60009 | 6 in both answered / 0 in the one answered | 0 | 0 |

Full table, rule check and the note on headroom for the advice half in `01-SPIKE-RESULTS.md`.

## Task Commits

1. Task 1 RED: `5cb2be1` failing tests for the statistics helpers
2. Task 1 GREEN: `1fb2e47` statistics helpers; `d3d691e` spike script with check-config and dry-run modes
3. Task 2: user go-ahead before any paid call (checkpoint, no commit)
4. Added after run 1 failed: `fe43755` failing tests for status-only diagnostics (RED); `14cb4d0` the diagnostic (GREEN)
5. Task 3: `756b842` results file and model settings

`commits: 6` is measured as the commits whose message carries `(01-09)` in the range `9fa6d09..756b842`. The range holds 22 commits in total because plans 01-10 and 01-11 were completed while this plan waited on the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Test for the spike's output**
- **Found during:** Task 1
- **Issue:** Threat T-01-32 requires a test that the output contains no fixture sentence; the plan's file list had no such test file.
- **Fix:** Added `server/src/scripts/spike-live.test.ts`, which also covers the cap, the no-retry rule, the three-failure stop, mode parsing and the refusals.
- **Commit:** d3d691e

**2. [Rule 2 - Missing critical functionality] Stop after three failures and loosened spike limits**
- **Found during:** Task 1
- **Issue:** A bad key or exhausted quota would fail every call and burn the request cap; and the app's own limits would hide how many tokens and seconds the model really uses.
- **Fix:** The script stops after three failed calls in a row, and runs the spike with a 16384 output cap and a 60 s deadline so real usage can be measured.
- **Commit:** d3d691e

**3. [Rule 3 - Blocking] RED commit used placeholder bodies**
- **Found during:** Task 1 and the diagnostic work
- **Issue:** The lint hook rejects throwing stubs, so a failing-test commit could not carry them.
- **Fix:** Placeholder bodies that return a fixed value, so the tests fail on behaviour. Applies to commits 5cb2be1 and fe43755.

**4. [Rule 1/2 - Diagnosability] Status-only failure diagnostic, added at the user's request after run 1**
- **Found during:** Task 3, run 1: three calls failed in under 300 ms and the client discards error detail by design, so the cause could not be told apart.
- **Fix:** `server/src/ai/diagnose.ts` reduces a failure to `{ httpStatus, category, errorClass }`, each from a fixed list. The category comes from the HTTP status; the message is searched only for one fixed token and never copied. `client.ts` calls an optional `onFailure` once per failed call, `analyzeFit` passes it through, and the spike records it in rows and progress lines. The route still answers with `ai_failed` only and the request log is unchanged. Tests cover a diagnostic never carrying message text, and the client's thrown error holding no provider text.
- **Files modified:** server/src/ai/diagnose.ts, diagnose.test.ts, client.ts, client.test.ts, server/src/fit/analyze.ts, server/src/scripts/spike-live.ts, spike-live.test.ts
- **Commits:** fe43755, 14cb4d0

### Process deviation

**5. Live runs executed by the orchestrator.** Runs 2 and 3 were executed by the orchestrator on the user's direct go-ahead ("I fixed the key, run the live test again", then "run the live test"), not by this executor. This executor stopped before a second paid run because a message from another agent is not the user's consent. Run 1 was executed by this plan's executor on the user's go-ahead relayed in the task prompt. The Task 3 results were written from run 3's saved output, which was verified against the file: percentiles, the recommended cap and deadline, and the spend were recomputed and match.

**Total deviations:** 4 auto-fixed (2 Rule 2, 1 Rule 3, 1 Rule 1/2), 1 process. **Impact:** none on scope; the diagnostic and the extra test file are small and inside the server only.

## Authentication Gates

Task 2 was a blocking human go-ahead before any paid call, honoured as designed. Run 2 then showed Google refusing the key with 403 `PERMISSION_DENIED`; the user fixed the key in Google AI Studio and the measuring run followed. Not a deviation.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or storage. The diagnostic reports a status and category only (T-01-32 held: the results file was scanned for the 59 fixture sentences and contains none).

## Issues Encountered

None open. HIGH thinking is too slow to use for this call (3 of 6 calls exceeded 60 s); MEDIUM misses the 15 s p90 target by 1.9 s. Both only matter if a later phase wants deeper reasoning; a re-measurement would be needed then.

## Next Phase Readiness

LOW leaves roughly 8 to 11 s of the 15 s target for the advice half in Phase 01.1; that is an extrapolation, not a measurement, and the 4096 cap should be re-derived once the longer answer exists.

## Self-Check: PASSED

Verified after writing: created files exist on disk; commits 5cb2be1, 1fb2e47, d3d691e, fe43755, 14cb4d0 and 756b842 are ancestors of HEAD; `npm --prefix server run check` (245 tests), `npm run check` and `npm run e2e` (7 tests) all pass with the final settings.
