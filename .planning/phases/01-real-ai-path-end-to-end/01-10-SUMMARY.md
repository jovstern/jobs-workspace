---
phase: 01-real-ai-path-end-to-end
plan: 10
subsystem: ui
tags: [react, zustand, zod, radix-progress, tanstack-query, playwright, vitest, scoring]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-07 verified ratings (quoteRejected downgrade) and the hallucinated_quote stand-in scenario; 01-08 saved resume with textHash and the main-flow browser test; 01-03 FitPanel props, fit store and useCheckFit"
provides:
  - "computeFit, bandFor, BANDS, CREDIT in shared: the score and band as a pure function of requirements and ratings"
  - "selectCurrentAnalysis and buildFitView: pure selectors for which stored result is current and what the panel shows"
  - "FitPanel with none, running, error and result states; ScoreBlock; RequirementsSection; Badge"
  - "Mutation defaults retry false and networkMode always on the query client"
  - "Browser tests for score shape, reload with no new request, bands, rejected quote and 503 then one-click retry"
affects: [01-11, 01.1, 01.2]

actuals:
  tokens: 13000
  tasks: 3
  commits: 8
plan_head_before: 14cb4d056bd7c9c26bdc749ff1f9c12d849de7bd
plan_head_after: 5f2caa05ebe739b6145abcc35e20c01f8e3be95f

tech-stack:
  added: []
  patterns:
    - "The score is derived in render from stored ratings (buildFitView calls computeFit); no score or band field exists in any schema or store"
    - "A stored result is current only for the same resume hash and job content version, otherwise the panel is in the no-result state"
    - "Focus moves to a control that mounts after a click through a module-level ref callback and a click-set flag, with no effect"
    - "A live status region is always rendered (visually hidden when idle) so both the running text and the completion announcement are heard"

key-files:
  created:
    - shared/src/fit/score.ts
    - shared/src/fit/score.test.ts
    - src/features/fit-analysis/selectors.ts
    - src/features/fit-analysis/selectors.test.ts
    - src/features/fit-analysis/ScoreBlock.tsx
    - src/features/fit-analysis/RequirementsSection.tsx
    - src/components/Badge.tsx
  modified:
    - shared/src/index.ts
    - src/features/fit-analysis/FitPanel.tsx
    - src/features/fit-analysis/FitPanel.test.tsx
    - src/features/fit-analysis/fit-store.test.ts
    - src/lib/query-client.ts
    - e2e/check-fit.spec.ts

key-decisions:
  - "Score formula Math.round(100 x requiredAverage x (0.9 + 0.1 x niceAverage)); the 5 met and 1 partial case gives 83 with this order of operations, as research predicted"
  - "Every failure except ai_not_configured shows the one fixed message 'Something went wrong on our side. Try again.' with a Try again button, ignoring the server's per-code wording (per-code table is Phase 01.1); this replaces the 01-03 behaviour of showing the server message and hiding retry for non-retryable codes"
  - "The fit panel root is a plain div, not a section, so the detail pane no longer has a nested landmark; the title heading is now 'Your fit for {title}', which resolves the duplicate-title item deferred from 01-05"
  - "The completion announcement appears only when the mutation in this panel succeeded, so reopening a stored result is silent"

patterns-established:
  - "Rating badge: glyph in an aria-hidden span and the word in its own span, so the word is the badge's accessible text and is matchable on its own"

requirements-completed: [FIT-02, FIT-03, FIT-08, DATA-01]

duration: 17 min
completed: 2026-10-11
---

# Phase 1 Plan 10: Fit score and result panel Summary

**The fit score and band are computed in code from per-requirement ratings, and the fit panel shows every requirement with its rating, resume quote and reason, plus honest running and failed states, with stored results shown at once and never triggering another AI call.**

## Accomplishments

- Shared `computeFit` / `bandFor`: required average carries the score, nice-to-have adds at most 10 points, no required items gives no score. Bands are inclusive at 80, 60 and 40. The whole scenario table from research B.3 (90, 100, 83, 75, 60, 67, 45, 33, 0), the band boundaries, a monotonicity check over all 243 rating combinations and the bonus cap are tests.
- Pure selectors: `selectCurrentAnalysis` (resume hash and job content version must both match) and `buildFitView` (posting order, unrated means not evidenced, score recomputed every time, a tampered stored `score` is ignored).
- Fit panel rewritten: heading "Your fit for {title}", score block (estimate caption, percentage, band badge, required count, disclaimer, checked date), Required and Nice to have lists with badge, "From your resume:" blockquote, rationale and the rejected-quote sentence. Running state with Radix indeterminate Progress and a status line. One alert for failures with a click-only Try again; set-up message with no retry for `ai_not_configured`; a failed re-check keeps the previous result below the notice.
- `Badge` component with the five tones; low bands and Not evidenced use neutral and caution, nothing uses the danger tone.
- Query client: `mutations: { retry: false, networkMode: 'always' }`.
- Browser test extended: score shape, same score after reload with the request count unchanged, and three stand-in tests (Strong fit 6 of 6 vs Long shot, rejected quote, 503 then one click on Try again with exactly two requests at the stand-in).

## Deviations from Plan

None - plan executed exactly as written. Notes that are not deviations:

- **TDD stand-ins.** The RED commits for `score.ts` and `selectors.ts` include a stand-in module returning empty results, so the tests fail on their assertions rather than on a missing import. The stand-in had to use its arguments to pass the pre-commit lint. In `selectors.test.ts` the four "returns null" cases pass against the stand-in by design; the five positive cases failed. RED was verified by reading the runner output (21 of 25 and 5 of 9 failing); `gsd_run check tdd-red-evidence` was not run because `workflow.tdd_mode` is off and the plan is `type: execute`.
- **`fit-store.ts` unchanged.** The new store tests passed against it. One first draft of the rehydrate test failed because `setState` itself writes the persisted key; the test was corrected to simulate a refresh by reloading the module, not the store.
- **Bonus-cap interpretation.** The plan says nice-to-have adds "at most 10 percent of the required-only score". With the specified formula the bonus is at most 10 points scaled by the required average (so up to one ninth of the nice-free score). The test asserts that bound and that the all-nice score never exceeds the unscaled required average.
- **Date format.** `en-GB` with a short month renders September as "Sept"; October (and the plan's examples) are unaffected.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## TDD Gate Compliance

Tasks 1 and 2 follow test then feat commits (`905e942` then `ed8ac46`; `4cdd742` then `c56bced`). Task 3 follows `f9cee82` (panel tests, 18 of 19 failing against the tracer panel) then `e9399a2`. The store tests (`95bc74b`) test existing behaviour and passed on first run.

## Verification

- `npx vitest run shared/src/fit/score.test.ts`: 25 passed. `npm --prefix server run typecheck`: clean.
- `npm run check`: format, lint, typecheck, 190 unit tests and build all pass.
- `npm --prefix server run check`: 245 tests pass.
- `npm run e2e`: 5 passed (three tagged `@fake-only`). Nothing left listening on 4173, 3101 or 3199.
- Acceptance greps: no `dangerouslySetInnerHTML`, `useEffect` or native `disabled` in the fit-analysis components; `retry: false` and `networkMode: 'always'` present; no `score` or `band` field in `fit-store.ts` or `storedAnalysisSchema`; `selectors.ts` imports no hook or store.
- Backstop (768px wrapping): a throwaway browser run at 768px with a 25-word quote and a 300-character rationale (including a long unbroken token) on every rated requirement. Document width equalled the viewport (no horizontal overflow), the blockquote stayed inside the list width with its 2px left rule, and all text wrapped. The throwaway script and screenshot were deleted.

## Known Stubs

None.

## Threat Flags

None. The mitigations in the plan's threat model are in place: plain-text rendering with a markup test (T-01-35), `selectCurrentAnalysis` mismatch tests (T-01-36), mutation defaults, `aria-disabled` while pending and the request count assertion at the stand-in (T-01-37), and no score field anywhere (T-01-38). No dependency was installed (T-01-SC).

## Next Phase Readiness

Ready for 01-11. Plan 01-09 (the live spike) is still open and was not touched; the live runs were refused with HTTP 403 on the user's side. The two items assigned to this plan in `deferred-items.md` are settled: the greeting form was already deleted in 01-08, and the duplicate title heading and nested section in the fit panel are fixed here.

## Self-Check: PASSED

All created files exist on disk and all eight task commits are ancestors of HEAD (checked below).
