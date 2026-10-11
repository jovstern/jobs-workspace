---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Real AI path, end to end
status: executing
stopped_at: Completed 01-05-PLAN.md
last_updated: "2026-10-11T08:02:29.344Z"
last_activity: 2026-10-11
last_activity_desc: Phase 01 execution started
state_head: 21d18cc364a61cc87af03ccb80a6f9319cd4bebe
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 11
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-10)

**Core value:** The user can search for jobs and see and update the progress of every application on the same page, without ever losing their search context.
**Current focus:** Phase 01 — Real AI path, end to end

## Current Position

Phase: 01 (Real AI path, end to end) — EXECUTING
Plan: 6 of 11
Status: Ready to execute
Last activity: 2026-10-11 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

Last session: 2026-10-11T08:02:29.320Z
Stopped at: Completed 01-05-PLAN.md
Resume file: None
