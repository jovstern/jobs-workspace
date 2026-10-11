---
phase: 01-real-ai-path-end-to-end
plan: 02
subsystem: api
tags: [gemini, google-genai, express, zod, contracts, stand-in-model, tracer]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-01 shared workspace, error envelope, pinned @google/genai 2.28.0"
provides:
  - "Phase 1 wire contracts in @jobs-workspace/shared: job, resume and fit schemas, with profile: null and advice: null reserved from version 1"
  - "One hand-written seed job (job-frontend-senior, requirements fe-sr-r1 to fe-sr-r8) with a computed content version"
  - "AiClient seam and createGeminiClient over generateContent with strict result interpretation"
  - "POST /api/fit returning per-requirement ratings, validated end to end"
  - "fake-gemini stand-in model (rule-based, 7 failure/behaviour scenarios, request counter) usable in tests and as a program"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 11800
  tasks: 2
  commits: 2
plan_head_before: 3070f82023e147fce2c29c0488b3230dc8d94b9c
plan_head_after: e0c20f89b3a889e8c9e684640cb850c134842dcb

tech-stack:
  added: []
  patterns:
    - "AiClient.generateJson(task, schema): callers name a task, never a model id; MODELS holds the id, thinking level, output cap and deadline"
    - "Every provider failure (HTTP error, block, truncation, empty or malformed answer, abort, deadline) collapses to AppError ai_failed with a fixed public message"
    - "Stand-in model reached through GEMINI_BASE_URL so tests exercise the real SDK request path with no key and no network"
    - "Route-scoped express.json; central errorHandler that never echoes a thrown message"

key-files:
  created:
    - shared/src/job.ts
    - shared/src/resume.ts
    - shared/src/fit.ts
    - server/src/jobs/seed.ts
    - server/src/config/env.ts
    - server/src/config/models.ts
    - server/src/http/errors.ts
    - server/src/ai/client.ts
    - server/src/test-support/fake-gemini.ts
    - server/src/fit/routes.ts
    - server/src/fit/routes.test.ts
  modified:
    - shared/src/index.ts
    - server/src/app.ts

key-decisions:
  - "createApp resolves only ai and now from its deps; env and log are accepted in AppDeps but consumed by plans 01-06 (request log, origin checks) so no unused code was added"
  - "canonicaliseResumeText strips control characters by code point instead of a control-character regex, so no eslint-disable was needed"
  - "The stand-in only quotes resume lines of at most 25 words, so every quote it returns is verbatim resume text"

requirements-completed: [FIT-01, DATA-06, DATA-07]

coverage:
  - id: D1
    description: "POST /api/fit returns one rating per seed-job requirement in posting order, produced by a schema-constrained generateContent call through the real SDK"
    requirement: FIT-01
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#returns one rating per requirement, in posting order, with verbatim quotes"
        status: pass
    human_judgment: false
  - id: D2
    description: "The request on the wire is a plain generateContent call with application/json output and no sampling, tool, seed or candidate-count options"
    requirement: DATA-06
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#sends a plain generateContent request with no sampling, tool or seed options"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unknown request fields, short resumes and unknown jobs are rejected before any model call; with no key the server answers 503 ai_not_configured without calling a model"
    requirement: DATA-07
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#requests that must never reach the model"
        status: pass
      - kind: integration
        ref: "server/src/fit/routes.test.ts#answers 503 ai_not_configured without calling any model when no AI client is set"
        status: pass
    human_judgment: false
  - id: D4
    description: "Upstream 429 and 503, blocked, truncated and malformed answers, and a missed deadline each end in 502 ai_failed after exactly one upstream request"
    requirement: FIT-01
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#model and upstream failures"
        status: pass
      - kind: integration
        ref: "server/src/fit/routes.test.ts#a missed deadline rejects with ai_failed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Concurrent requests with different resumes get quotes only from their own resume, and no response body contains the AI key"
    requirement: DATA-07
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#two simultaneous requests with different resumes get quotes only from their own resume"
        status: pass
      - kind: integration
        ref: "server/src/fit/routes.test.ts#no response body contains the AI key"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-11
---

# Phase 1 Plan 02: Fit contracts and the server tracer Summary

**POST /api/fit now takes a job id and resume text, calls Gemini's generateContent through the real `@google/genai` SDK with a schema-constrained response, and returns validated per-requirement ratings; in tests the SDK talks to a rule-based stand-in model on localhost, so the whole path runs with no key and no network.**

## Accomplishments

- Task 1: shared `job`, `resume` and `fit` contracts exactly as the plan's interface block specifies (40-label skill vocabulary, strict fit request, stored analysis with `advice: null`, stored resume with `profile: null`, no numeric score field anywhere), plus the seed job `job-frontend-senior` (fictional company Brightwell Labs, 8 requirements, 6 required) validated at module load, with `contentVersion` computed from `[id, kind, text]` triples (`14714af0fe5ddc87`).
- Task 2 (tracer): `config/env.ts` (pure `parseEnv`, `loadServerEnv` using `process.loadEnvFile`, ENOENT ignored, process env wins), `config/models.ts` (the only file naming `gemini-3.8-flash`), `http/errors.ts` (`AppError`, `parseBody`, `notFoundHandler`, `errorHandler` with fixed public messages), `ai/client.ts` (`AiClient`, `createGeminiClient`), `test-support/fake-gemini.ts`, `fit/routes.ts` and the `app.ts` rewiring (global `express.json()` removed, router mounted at `/api/fit`).
- Tests were written first and run red (module not found), then green: 17 route tests (the 8 plan cases, with the validation and failure cases expanded into tables) and the 2 existing app tests.
- Tracer feedback gate: interactive mode, `end-of-phase`, automated-only `<verify>`: both verify commands were re-run after the commit and passed ("Tracer verified end-to-end"). No expansion task follows in this plan.

## Verification

- `npm --prefix server run test -- src/fit/routes.test.ts`: 17 passed.
- `npm --prefix server run check`: lint, typecheck, 19 tests pass (exit 0).
- `npm run check`: format, lint, typecheck, unit tests (5), build pass (exit 0).
- Acceptance greps: `gemini-3.8-flash` appears in `server/src` outside tests only in `config/models.ts`; `ai/client.ts` contains none of temperature, topP, topK, seed, candidateCount, tools, safetySettings, retryOptions, interactions; `app.ts` has no `express.json`, `fit/routes.ts` applies it with `256kb`; the only code that loads the server environment file is `process.loadEnvFile` in `config/env.ts`.
- Ran the stand-in as a program (`FAKE_GEMINI_PORT=3197 npm --prefix server run fake-gemini`): it prints its listening line and answers `/__count`, `/__scenario` and `/__reset`.
- `npm run e2e` was not run: this plan changes no browser code.

## Task Commits

| Task | Commit | Notes |
|---|---|---|
| 1 | bb3db6e | shared contracts, seed job |
| 2 | e0c20f8 | tracer: AiClient, stand-in model, /api/fit, route tests |

## Deviations from Plan

None - plan executed exactly as written.

Two small judgement calls inside the plan's latitude, recorded for the verifier:

- `createApp` takes `Partial<AppDeps>` and reads only `ai` and `now`. The `env` and `log` fields exist in the `AppDeps` type but nothing consumes them yet (plan 01-06 adds the request log and origin check); reading them now would have meant dead code that lint rejects.
- The stand-in's keyword tables are `Partial<Record<Skill, ...>>` with a lower-cased-label default, as specified, rather than a full record, so coverage of all 40 labels is by table content, not enforced by the type.

## Issues Encountered

None.

## Known Stubs

None. Intentional placeholders by plan: `advice` and `profile` are `null` until Phases 01.1 and 01.2; `quoteRejected` is always `false` until quote verification in plan 01-07; the `onUsage` hook is implemented but nothing passes it yet (plan 01-09 uses it for measurements).

## Threat Flags

None. `POST /api/fit` and the model call are the trust boundaries already named in the plan's threat model. Mitigations in place: T-01-03 (key passed explicitly to the SDK, never logged, test asserts no response contains it), T-01-04 (strict request object, requirements from the server seed), T-01-05 (generateContent only, no tools, wire-level test), T-01-06 (no retry options, explicit deadline, one upstream request asserted), T-01-07 (block reason, finish reason, empty text, JSON and Zod all checked), T-01-08 partly (instructions in the system instruction, data in tags; delimiter neutralisation and quote verification follow in plans 01-04 and 01-07).

## Next Phase Readiness

Ready for 01-03 (browser half of the tracer): `createApp({ ai })`, `createGeminiClient`, `loadServerEnv`, `listJobs` and the `POST /api/fit` contract are in place. `server/src/index.ts` is untouched and still starts with `ai: null`; plan 01-03 wires the real client there.

## Self-Check: PASSED

- FOUND: shared/src/job.ts, shared/src/resume.ts, shared/src/fit.ts, server/src/jobs/seed.ts, server/src/config/env.ts, server/src/config/models.ts, server/src/http/errors.ts, server/src/ai/client.ts, server/src/test-support/fake-gemini.ts, server/src/fit/routes.ts, server/src/fit/routes.test.ts
- FOUND commits: bb3db6e, e0c20f8
