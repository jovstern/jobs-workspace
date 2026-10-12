---
gsd_state_version: "1.0"
current_phase: "01.1"
current_phase_name: Gaps, learning plan, tips and failure handling (INSERTED)
status: executing
stopped_at: Completed 01.1-04-PLAN.md
last_updated: "2026-10-12T11:14:24.563Z"
last_activity: 2026-10-12
last_activity_desc: Phase 01.1 execution started
state_head: 464bc68af4b39d29cf1062018016cb4ba94bb0f7
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 20
  completed_plans: 16
  percent: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-10)

**Core value:** The user can search for jobs and see and update the progress of every application on the same page, without ever losing their search context.
**Current focus:** Phase 01.1 — Gaps, learning plan, tips and failure handling (INSERTED)

## Current Position

Phase: 01.1 (Gaps, learning plan, tips and failure handling (INSERTED)) — EXECUTING
Plan: 2 of 9
Status: Ready to execute
Last activity: 2026-10-12 — Phase 01.1 execution started

Progress: [█░░░░░░░░░] 11%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 11 | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 3min | 3 tasks | 13 files |
| Phase 01 P02 | 8 min | 2 tasks | 13 files |
| Phase 01 P03 | 25 min | 2 tasks | 16 files |
| Phase 01 P04 | 5 min | 2 tasks | 7 files |
| Phase 01 P05 | 34 min | 2 tasks | 15 files |
| Phase 01 P06 | 6 min | 3 tasks | 11 files |
| Phase 01 P07 | 9 min | 3 tasks | 11 files |
| Phase 01 P08 | 15 min | 3 tasks | 14 files |
| Phase 01 P10 | 17 min | 3 tasks | 13 files |
| Phase 01 P11 | 25 min | 3 tasks | 9 files |
| Phase 01 P09 | 256 min | 3 tasks | 11 files |
| Phase 01.1 P01 | unrecorded | 2 tasks | 14 files |
| Phase 01.1 P09 | 3 min | 2 tasks | 7 files |
| Phase 01.1 P02 | unrecorded | 3 tasks | 10 files |
| Phase 01.1 P03 | 8min | 2 tasks | 9 files |
| Phase 01.1 P04 | 8 min | 3 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Every phase ends in a browser-visible demo; no scaffolding phase (starter template and empty `server/` are built before Phase 1)
- [Roadmap]: Riskiest unknown first: real AI path (resume to profile to fit) is Phase 1 on hand-written seed jobs with a plain UI; design system lands in Phase 2
- [Roadmap]: Fit score is computed in code from per-requirement ratings with resume quotes, never a model-made number
- [Roadmap]: AI results in persisted Zustand stores; chat streams inside a TanStack Query mutation; TanStack Router for URL state; applications store job id only
- [Roadmap]: Stage reorder by Move up / Move down only in v1; export/import/erase is the final phase with its own demo

- [Roadmap] 2026-10-10: Phase 1 split into Phases 1, 01.1 and 01.2 (user decision at planning; the original 20-requirement phase was too large to plan at full quality). Phase 1's CONTEXT, RESEARCH, UI-SPEC, PATTERNS and VALIDATION files cover the union of the three; Phases 01.1 and 01.2 reuse them.
- [Phase 01]: 01-01: @google/genai pinned exactly at 2.28.0 in the server workspace after user-approved registry check (D-20)
- [Phase 01]: 01-01: tsconfig include for shared applied in the Task 2 commit because the pre-commit lint could not parse shared/ without it
- [Phase 01]: Seed job id job-frontend-senior and requirement ids fe-sr-r1 to fe-sr-r8 are final; AiClient keeps the provider inside server/src/ai and model ids live only in config/models.ts
- [Phase 01]: createApp reads only ai and now from its deps; env and log are typed in AppDeps but consumed by plan 01-06
- [Phase 01]: Plan 01-03: browser-test preview server never reuses an existing server (reuseExistingServer false) so a stale preview cannot proxy to a developer's API
- [Phase 01]: Plan 01-03: FitPanel shows the server's fixed per-code error message; Try again is hidden for non-retryable errors
- [Phase 01]: 01-04: resume/job tag neutralisation also catches tags written with spaces inside the bracket (< / resume >)
- [Phase 01]: 01-04: a UK postcode is its own pattern and removes only the postcode, so London NW1 6XE keeps the word London
- [Phase 01]: 01-04: plus-prefixed phone candidates are validated in code (8+ digits, no spaced hyphen) to keep the pattern bounded
- [Phase 01]: Seed job and requirement ids pinned as literals in seed.test.ts; job-frontend-senior content version 14714af0fe5ddc87 unchanged
- [Phase 01]: FitPanel left untouched in 01-05; its duplicate title heading and nested section are deferred to plan 01-10
- [Phase 01]: 01-06: rate limiter hand-written (D-19), no dependency; origin guard runs before the limiter so refused foreign requests use no quota
- [Phase 01]: 01-06: content-type rule covers every method except GET, HEAD, OPTIONS; non-JSON fit POST now answers 415
- [Phase 01]: 01-07: the 12 character quote minimum applies to normalised ellipsis segments summed; a withdrawn rating loses its rationale as well as its quote
- [Phase 01]: 01-08: approved skill-file change applied; greeting form deleted and the Forms rule names src/features/resume/PasteForm.tsx
- [Phase 01]: 01-08: buildResumeRecord is the only constructor of a stored resume, so nothing is saved or sent without contact removal; the saved announcement fills only after a save in the current session
- [Phase 01]: 01-10: every fit failure except ai_not_configured shows one fixed retryable message; the per-code table stays Phase 01.1
- [Phase 01]: 01-10: score = round(100 x requiredAvg x (0.9 + 0.1 x niceAvg)), derived in render, never stored; a stored result for another resume hash or job version is hidden, not marked
- [Phase 01]: Privacy note ships with the paid-tier paragraph: user confirmed billing on the key's Google project (2026-10-11). PAID_TIER_CONFIRMED in PrivacyNote.tsx must be set to false if billing lapses.
- [Phase 01]: 01-09: LOW thinking chosen from live measurements (p90 4698 ms, 6/6 required met near-perfect, 0 met poor, 0 flips); MEDIUM p90 16900 ms missed the 15 s target and HIGH failed 3 of 6 calls at 60 s
- [Phase 01]: 01-09: MODELS.fit output cap 4096 and deadline 30000 ms follow from the stated rule (floors apply) and were not tested directly; the spike ran at 16384 and 60000
- [Phase 01]: 01-09: failure diagnostics are a closed vocabulary (status number, category, class name from fixed lists) and are surfaced only in the spike; the route and request log are unchanged
- [Phase 01.1]: Advice is stored as adviceSchema.nullable(); schema version stays 1 so older records remain valid
- [Phase 01.1]: Strict wire schema for the provider, lenient parse schema for the answer; buildAdvice validates plans and never fails the response
- [Phase 01.1]: 01.1-09: failureToErrorCode reads only status and category; upstream 504 is ai_overloaded, ai_timeout is the app's own deadline
- [Phase 01.1]: 01.1-02: notice Check again and Check my fit share one pending-focus ref; focus goes to the header Check again button, with no effect in FitPanel
- [Phase 01.1]: 01.1-03: one surviving plan step keeps the plan; steps beyond four are cut, not the plan dropped
- [Phase 01.1]: 01.1-03: link regex tightened for data: URLs; 12-name learning-platform deny-list kept as best-effort
- [Phase 01.1]: 01.1-04: saved-data detection lives in a guarded PersistStorage getItem; set-aside copies keyed {store}:corrupt:{ISO}, 3 kept per store; persist versions stay 1

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] AI provider is Gemini (user decision, 2026-10-10; key is `GEMINI_API_KEY` in `server/.env`). The Claude-specific findings in `.planning/research/` (SDK, model ids, API parameter limits, PDF document block, prompt caching) no longer apply; Phase 1 research must cover the Gemini SDK, schema-constrained output with Zod, PDF input, streaming and model choice
- [Phase 1] Spike first: one real schema-constrained Gemini call; measure fit latency (target under about 15 s) and decide one call vs split
- [Phase 1] Keep model ids in one server config module; choose a fast model for resume parsing and a stronger one for fit analysis after the spike
- [Phase 1] Build a 5-8 file synthetic resume corpus before deciding whether the send-the-PDF-to-the-model fallback is needed; decide whether job `requirements[]` is authored in the seed (the code-computed score depends on it being stable)
- [Phase 1] Confirm `shared/` as an npm workspace package (single Zod copy) and TypeScript 7.0.2 tooling compatibility at scaffold time
- [Phase 2] Check the LinkedIn-like palette against the live jobs page; only `#0A66C2` and `#004182` are corroborated
- [Phase 4] Optional spike: `@dnd-kit/react` under the React Compiler (drag is deferred in v1, buttons ship regardless)
- [Phase 6] Spike streaming through the Vite dev proxy: no buffering, abort on unmount, wrong-thread safety

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-12T11:14:24.527Z
Stopped at: Completed 01.1-04-PLAN.md
Resume file: None
