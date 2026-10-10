---
gsd_state_version: "1.0"
current_phase: 1
current_phase_name: Real AI path, end to end
status: planning
stopped_at: Phase 1 UI-SPEC approved
last_updated: "2026-10-10T17:32:10.232Z"
last_activity: 2026-10-10
last_activity_desc: Roadmap created (7 phases, 72/72 v1 requirements mapped)
state_head: e65f3322794571495d45b78f6780b0d8ec1bedb4
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-10)

**Core value:** The user can search for jobs and see and update the progress of every application on the same page, without ever losing their search context.
**Current focus:** Phase 1 - Real AI path, end to end

## Current Position

Phase: 1 of 7 (Real AI path, end to end)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-10-10 - Roadmap created (7 phases, 72/72 v1 requirements mapped)

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Every phase ends in a browser-visible demo; no scaffolding phase (starter template and empty `server/` are built before Phase 1)
- [Roadmap]: Riskiest unknown first: real AI path (resume to profile to fit) is Phase 1 on hand-written seed jobs with a plain UI; design system lands in Phase 2
- [Roadmap]: Fit score is computed in code from per-requirement ratings with resume quotes, never a model-made number
- [Roadmap]: AI results in persisted Zustand stores; chat streams inside a TanStack Query mutation; TanStack Router for URL state; applications store job id only
- [Roadmap]: Stage reorder by Move up / Move down only in v1; export/import/erase is the final phase with its own demo

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

Last session: 2026-10-10T17:32:10.218Z
Stopped at: Phase 1 UI-SPEC approved
Resume file: .planning/phases/01-real-ai-path-end-to-end/01-UI-SPEC.md
