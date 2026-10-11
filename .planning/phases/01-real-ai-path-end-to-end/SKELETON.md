# Walking Skeleton — Jobs Workspace

**Phase:** 1
**Generated:** 2026-10-10

## Capability Proven End-to-End

A job seeker enters resume text in the browser, picks a seed job, clicks "Check my fit", and
sees a rating for every job requirement produced by a schema-constrained call through the
Gemini SDK; the result is stored in the browser and is shown again after a refresh with no new
AI request.

The skeleton is plans 01-01, 01-02 and 01-03. Plan 01-01 is set-up only (a registry check that
must precede the install, the workspace, the approved configuration). The tracer is in two
halves because one file per layer is more than one plan can hold in this scaffold: plan 01-02
proves the server half over real HTTP through the real SDK, and plan 01-03 proves the whole path
in a real browser. Plans 01-04 to 01-11 expand the proven slice.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite + React 19 with the React Compiler, TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zustand; Express 5 in `server/` | Fixed by `.claude/skills/stack-conventions` before kickoff |
| Package layout | npm workspaces: root (client), `server`, `shared`; one root lockfile; `@jobs-workspace/shared` is TypeScript source with no build step | D-16. One Zod copy on both sides, one module for request and response schemas |
| Data layer | No database. The server is stateless. User records live in persisted Zustand stores over `localStorage`: `jw:resume` and `jw:analyses`, each with a persist `version`, validated with Zod on load | User decision: browser-only data; signed-off reading that analyses and the resume are the user's own records |
| Reserved shapes | The stored resume carries `profile: null` and the stored analysis carries `advice: null` from version 1 | Phases 01.2 and 01.1 widen them without a storage migration |
| Server data in the client | Jobs and health go through TanStack Query (`queryOptions` in the feature folder), parsed with shared Zod schemas; never copied into a store | Stack rule |
| Paid calls | TanStack Query mutations with `retry: false` and `networkMode: 'always'`; results written to the store in the hook-level `onSuccess`; started only from click handlers | A paid call must never fire implicitly |
| AI provider | Google Gemini through `@google/genai` 2.28.0, `generateContent` only, behind an `AiClient` interface in `server/src/ai` | D-01. No Interactions API (retention), no Files API, no tools, no SDK retries, no sampling parameters |
| Model configuration | One module, `server/src/config/models.ts`: model id, thinking level, output cap, deadline | D-04. Tuned from the live spike in plan 01-09 |
| Structured output | `responseMimeType: application/json` with `responseJsonSchema` generated from a Zod schema by `toGeminiSchema`; strict Zod validation after the response | Research A.2; only documented keywords are sent |
| Evidence and score | The model returns ratings and quotes only. The server verifies every quote against the text it sent and reconciles ids against the seed. The score and band are computed in shared code in the browser and never stored | Project rule: the score is computed in code |
| Contact details | One shared pure function removes email addresses, phone numbers, street addresses and links; applied in the browser before saving and enforced on the server before every model call | D-07, D-18 |
| Auth | None. Single local user. The server binds `127.0.0.1`, checks Host and Origin, accepts JSON only, and rate-limits the paid route with hand-written code | D-19; the key must not be spendable by another origin |
| Secrets | `GEMINI_API_KEY` only in `server/.env`, loaded by `process.loadEnvFile` in `server/src/config/env.ts`; never a `VITE_` variable; never logged | CLAUDE.md hard rule |
| Errors | One typed envelope `{ error: { code, message, retryable } }` from a central handler; the client branches on `code` | Phase 1 has one generic retryable message and the not-configured message; the full table is Phase 01.1 |
| Testing without a key | A stand-in model over HTTP (`server/src/test-support/fake-gemini.ts`) that the real SDK calls through `GEMINI_BASE_URL`; rule-based, with failure scenarios and a request counter | Every gate exercises the real request path with no key and no network |
| Browser tests | Playwright starts the stand-in (3199), its own API (3101) and the client (4173); it never reuses a running API. `REAL_AI=1` switches to the real model for the demo | A browser test must not spend the real key |
| Deployment target | Local only: `npm run dev` plus `npm --prefix server run dev`; the browser reaches the API through the Vite `/api` proxy on the same origin | No hosting in the first version |
| Directory layout | `src/features/<feature>/` (components, stores, queries, tests together), `src/components/` (shared presentational pieces), `src/lib/`; `server/src/{config,http,ai,fit,jobs,scripts,test-support}`; `shared/src/`; `e2e/` | Stack rule; server scripts and seed data stay under `server/src` so server lint and TypeScript configuration need no change |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — existing starter, extended with the workspace and the approved configuration changes in plan 01-01
- [x] Routing — real routes `GET /api/health`, `GET /api/jobs`, `POST /api/fit`; the client is a single page (URL state arrives with TanStack Router in Phase 2)
- [x] Database — one real write and one real read of browser storage: the analysis is written to `jw:analyses` on success and read back after a refresh (plan 01-03); the resume follows in plan 01-08
- [x] UI — "Check my fit" wired through TanStack Query to the API and on to the model (plan 01-03)
- [x] Deployment — documented local full-stack run: `npm --prefix server run dev` and `npm run dev`; gates `npm run check`, `npm --prefix server run check`, `npm run e2e`

## Out of Scope (Deferred to Later Slices)

- Gaps list, learning plan, tailoring tips; the full per-error message table and staged progress; migration and set-aside of corrupted storage with a visible notice (Phase 01.1)
- PDF upload and the unreadable-PDF fallback, the two-step review dialog, the structured profile, "I do have this", replace and delete, the "resume changed, re-check?" marker (Phase 01.2)
- Three-pane layout, LinkedIn-style shell, design system, search, URL state, fit score on result cards (Phase 2)
- Application tracking, stages, pipeline strip, nudges (Phases 3 to 5); streaming chat (Phase 6); export, import and erase (Phase 7)
- Accounts, hosting, mobile layout, dark theme, languages other than English

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its
architectural decisions:

- Phase 01.1: gaps, learning plan and tips (the advice half of the model contract); distinct failure messages and progress; storage migration and set-aside
- Phase 01.2: PDF upload, two-step review, profile, resume lifecycle, "I do have this", stale marker
- Phase 2: three-pane workspace, search and filters, design system, fit score on result cards
- Phase 3: save and mark applied; stage on cards, detail pane and rail
- Phase 4: stage editing and close-out
- Phase 5: pipeline strip and nudges
- Phase 6: streaming "ask about this job" chat (`generateContentStream` behind the same `AiClient`)
- Phase 7: export, import and erase
