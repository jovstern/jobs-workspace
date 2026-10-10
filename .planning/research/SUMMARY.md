# Project Research Summary

**Project:** Jobs Workspace
**Domain:** LinkedIn-style job search page with built-in application tracking and AI resume-to-job fit analysis (single user, browser-persisted, seeded listings, stateless Express proxy to Claude)
**Researched:** 2026-10-10
**Confidence:** MEDIUM-HIGH (stack versions and structure are well verified; the AI path, PDF extraction and a few library behaviours are unproven until Phase 1)

## Executive Summary

This is a three-pane workspace (results, selected job, "My applications" rail) where search, tracking and AI fit analysis share one page and one source of truth. Experts keep a single client-owned application collection and derive every view from it. Result card badge, rail row, pipeline strip and nudges are all pure selectors over that collection, never stored copies. Server data (seeded jobs) lives in TanStack Query. User-owned records (applications, resume, cached analyses) live in versioned, Zod-validated, persisted Zustand stores. The AI is a thin, tool-less, server-side layer. The key never leaves `server/`, the client sends semantic inputs only, and every model output is schema-constrained, re-validated and treated as untrusted.

The recommended approach is to prove the real AI path first (resume to parsed profile to fit analysis, in a plain-styled slice). After that come the workspace and design system, the tracker in layers (core, stage editing and close-out, strip and nudges), streaming chat, and hardening. The riskiest unknown is whether a fit result is trustworthy and stable, not the API call itself. All four researchers converge on one design. The model rates discrete job requirements with evidence quotes, and the headline score is computed in code. An editable resume-review step is the main control against bad extraction, hallucination and injection. Phase 1 must settle that schema, because every later UI sits on top of it.

Key risks and mitigations:
1. A made-up or unstable fit score. Mitigation: per-requirement ratings, quote verification and a golden-set test.
2. List and rail drifting apart. Mitigation: one store, derivation only, and a stable stage `kind` that the pipeline keys off.
3. Persisted-data breakage (schema change, quota, corruption, Safari 7-day eviction). Mitigation: `version`/`migrate`, Zod-on-hydrate with a corrupt backup, and export/import.
4. Resume privacy leaks through logs, fixtures and the per-phase demo GIFs. Mitigation: metadata-only logging and synthetic resumes only.

The researchers disagree in several places (listed below), and four stack-convention rules may not cleanly apply and need user sign-off.

## Key Findings

### Recommended Stack

The core stack is fixed by `stack-conventions`: Vite, React 19 with the Compiler, TypeScript strict, Tailwind 4, Radix, TanStack Query and Form, Zod 4, Zustand 5, Express 5 in `server/`. Research filled only the open pieces. See STACK.md for versions, all read from the npm registry on 2026-10-10.

**Core technologies (open pieces):**
- `@anthropic-ai/sdk` 0.133.0: Claude calls from Express. `messages.parse()` plus `zodOutputFormat` gives validated structured output and works with Zod 4.
- Models, set in one config module: `claude-sonnet-5-5` for fit analysis (effort `medium`) and chat (effort `low`). `claude-haiku-5-5` for resume parsing; it is 3 days old, so keep a Sonnet fallback in config. Do not use `temperature`, forced `tool_choice`, prefill or `thinking: disabled`; all return 400 on current models.
- `unpdf` 1.8.1 (PDF text) and `mammoth` 1.13.0 (DOCX text): pure-JS extraction on the server, memory only.
- Zustand `persist` + `localStorage`: applications, resume and analyses. Hydration is synchronous, `version`/`migrate` are built in, and the data is far below the 5 MiB cap.
- `date-fns` 4.4.0: calendar-day maths. Stage dates are date-only `YYYY-MM-DD` strings parsed with `parseISO`, and "today" comes from an injectable clock.
- `minisearch` 7.2.0 (see conflicts): in-memory job search. `@faker-js/faker` (dev only) with curated archetype tables for deterministic seed generation.
- `@dnd-kit/react` 0.5.0 (see conflicts): stage reorder, always paired with Move up/Move down buttons.
- `express-rate-limit` and `tsx`. Do not add `dotenv`, `cors`, `compression` (breaks SSE), `multer` or a router library.

**Critical requirements:** Node 24 (for `unpdf` and `process.loadEnvFile`). Express 5, where `req.query` is read-only, so validate into a local. TypeScript 7.0.2 is npm `latest` and its tooling compatibility (`tsc`, ESLint parser, `tsx`) was not researched.

### Expected Features

PROJECT.md scope was treated as decided. See FEATURES.md.

**Must have (table stakes):**
- Search, five filters, active-filter chips, sort, Load more, empty/loading/error states, viewed state, and keyboard navigation in the list.
- Result card with save toggle, stage pill (tracked state) and fit badge once analysed. Selection and search state survive any rail or detail action.
- Job detail with structured description, "Apply on company site" then a "Did you apply?" prompt, Save, and Mark applied with an editable date.
- Per-application stage timeline:
  - the default template, and add/rename/remove/reorder with suggestions;
  - status/date/notes, plus application notes;
  - close with reason, reopen, and closed history;
  - quick actions with Undo toasts.
- Pipeline strip as a filter, with mutually exclusive derived buckets and an explicitly defined response rate.
- Nudges (gone quiet, upcoming, overdue) with snooze.
- Resume intake (PDF or paste), editable parsed profile, replace/delete.
- "Check my fit" on demand: score band, strengths, gaps (required vs nice-to-have), cached by job plus resume, with a stale indicator.
- Versioned persistence across refresh.

**Should have (competitive):**
- Search results that know your pipeline (the headline differentiator), with a tracked-status search filter (All / Not yet tracked / Saved / Applied).
- Evidence-backed strengths and gaps. A learning plan per gap (topic, why, rough effort; no URLs or course names). Tailoring tips that surface only what is truthfully in the resume.
- Per-job grounded chat with suggested-prompt chips, a mini-stepper on rail items, and a needs-attention group in the rail.
- Export/import JSON and "clear all data". It is small and protects trust.

**Defer (v2+):**
- Accounts, sync, a real feed, email/push reminders, interview prep per stage, mobile layout, dark theme, i18n.
- v1.x candidates: "Add external application", per-stage "with whom", score breakdown by dimension, extra metrics, recent searches.
- Anti-features to hold the line on: kanban main view, Easy Apply form, auto fit on every result, resume builder or ATS checks, browser extension, contacts CRM.

### Architecture Approach

The client has three state owners. The URL owns navigation state (query, filters, selected job, rail filter). TanStack Query owns server data. Small persisted Zustand stores own user data.

A `workspace` feature is the only reader of the URL. It passes props to the `job-search`, `job-detail` and `pipeline` panes. Domain features (`jobs`, `applications`, `resume`, `fit-analysis`, `job-chat`) expose hooks through `index.ts` only.

Pure model and selector modules hold the highest-risk logic and carry the unit tests: stage operations, `phase()`, `currentStage()`, counts, and nudges that take `now`.

The server is routes, then Zod validation, then services, then a central error handler. Request and response schemas live in one shared module. Detail is in ARCHITECTURE.md.

**Major components:**
1. `shared/` contracts (Zod): one source for request/response shapes, imported by both sides.
2. `server/`: seeded jobs repo and search, `/api/resume/*`, `/api/fit`, `/api/chat`, key custody and error mapping. It holds no user data and logs metadata only.
3. `applications`: the single source of truth for tracked jobs (stages with stable `id` and `kind`, close-out), plus derived selectors used by cards, rail, strip and nudges.
4. `resume` and `fit-analysis`: persisted resume and analyses written from mutation `onSuccess`. The context is captured in mutation variables, so a result files under the right job and resume even if the user navigates away.
5. `workspace`, `job-search`, `job-detail`, `pipeline`, `shell`: composition and presentation. Phase 2 owns the design tokens and shared components.
6. `job-chat`: per-job thread and streaming consumer.

### Critical Pitfalls

1. **The fit score is a number the model made up.** Temperature cannot be fixed on current models.
   - Have the model rate each job requirement by enum (`met` / `partial` / `not_evidenced`) with an evidence quote, and compute the score and band in code.
   - Show a band plus breakdown with an "estimate" caption.
   - Gate with a small golden set (perfect, middling, terrible ordering).
2. **Hallucinated strengths and gaps.**
   - Require an evidence quote for every strength and `met`/`partial` rating, and substring-verify it server-side against the resume text. Demote failures.
   - Word gaps as "not evidenced in your resume" with an "I do have this" action.
   - Gaps may only reference the job's own requirement list.
3. **Prompt injection and unvalidated output.**
   - Keep instructions in `system` and untrusted text in delimiters. Give the model no tools.
   - Use schema-constrained output, re-validated on server and client. Check `stop_reason` for `refusal` and `max_tokens`.
   - Render output as plain text or sanitised markdown.
   - The code-computed score neutralises an injected "rate 100".
4. **Persisted data breaks** (schema change, quota, corruption, multi-tab, Safari 7-day eviction).
   - Version every store from day one and Zod-parse on hydrate. Move bad data to a `corrupt-<timestamp>` key.
   - Catch `QuotaExceededError` visibly, never store the PDF, sync tabs with the `storage` event, and ship export/import.
5. **List and rail drift; pipeline keyed on stage names.**
   - Keep one applications collection; everything else is a selector.
   - Each stage has a stable `kind` independent of its editable name.
   - Define `getCurrentStage`, buckets and response rate once, in a tested pure module that takes `now`.
6. **Privacy leaks through the "stateless" server and the demos.**
   - Log route, status, duration and token counts only. Use a central error handler. Never log bodies. Keep uploads in memory.
   - Every phase ends in a recorded GIF, so use a synthetic resume in all fixtures, e2e runs and recordings, never a real person's.
7. **Resume extraction trusted blindly.**
   - Always show the extracted/parsed profile for review and edit.
   - Add a quality gate: chars per page, alphabetic ratio, replacement characters.
   - Test on a corpus of single-column, two-column, sidebar, scanned, protected and oversized files.

Also keep in view:
- The API key must never be `VITE_`-prefixed. Add a `dist/` grep for `sk-ant`.
- The cache key must include the resume hash.
- Seed job ids must be stable, with a test.
- Dates must be date-only strings with an injectable clock.
- "Current stage" semantics for skipped, failed and reordered stages must be written down.

## Implications for Roadmap

The starter template (Vite app, lint, tests, CI) is scaffolded separately before Phase 1 and is not a roadmap phase. Every phase below ends in something a short GIF can show, and the real AI path is proven first. Seven phases is the recommended shape. UI and styling are carried by every phase, not left to the end.

### Phase 1: Real AI path, end to end
**Rationale:** This is the riskiest unknown. Resume to parsed profile to fit analysis involves PDF extraction quality, structured-output reliability, latency, prompt quality, key custody and the shared-contract layout. Every later phase builds on the result shape. The first task inside the phase is the API spike (see Research Flags).
**Delivers:**
- The `shared/` workspace package.
- An Express skeleton: env with Zod, `validate` middleware, typed error envelope, `/health` with `aiConfigured`, rate limit, loopback bind, metadata-only logging.
- `/api/resume/extract` (or equivalent), `/api/resume/parse` and `/api/fit`.
- 8-10 hand-written seed jobs with stable ids and structured `requirements[]`.
- A `createPersistedStore` helper: version, Zod hydrate, corrupt backup, quota toast.
- `resume` and `fit-analysis` features with a plain-styled `ResumeDialog` (editable profile review) and `FitPanel` on a stub page with a job picker.
- A synthetic resume corpus and a golden set.

**GIF:** Upload a synthetic PDF. See the editable parsed profile. Pick a job and click Check my fit. See score band, evidence-backed strengths, gaps with learning plan, and tailoring tips. Refresh and everything is still there. Replace the resume and the old result shows as stale.
**Addresses:** resume intake, profile review, on-demand fit, learning plan, tailoring tips, persistence skeleton.
**Avoids:** Pitfalls 1-6, 9, 10, 11 (explicit timeout, `maxRetries` 1, abort on disconnect, distinct typed errors), and the key in the client.

### Phase 2: Workspace, search and design system
**Rationale:** It needs Phase 1's server, contracts and fit panel. It establishes the design tokens, shared components and URL-state pattern that every later UI phase uses. It also provides the full dataset that makes search and the fit demo credible.
**Delivers:**
- Full seeded dataset: about 120 generated jobs plus about 15 hand-written edge cases, with a coverage test and a stable-id test.
- `/api/jobs` search and filters.
- A LinkedIn-like shell with inert-but-accessible nav and an own wordmark.
- Three-pane layout with an inert rail placeholder and explicit tablet breakpoints.
- URL state via a small `useSyncExternalStore` helper.
- Result cards with save placeholder, viewed state and fit chip.
- Job detail with Overview / My fit tabs hosting the Phase 1 panel.
- Keyboard navigation, and empty/loading/error states.

**GIF:** Search, filter, load more, open jobs. Refresh keeps context. Run a fit check and see the score appear on that job's card.
**Uses:** `minisearch`, `date-fns`, Tailwind `@theme` tokens (palette to be checked against the live site), Radix.
**Avoids:** Pitfalls 18-24 (selection and scroll, focus/landmarks, tablet, long content, states, branding/trademark, uniform seed).

### Phase 3: Applications core
**Rationale:** This is the core value (tracking on the same page as search) and the highest drift risk. It gets its own phase before any editing richness.
**Delivers:**
- `applications` schema, model and selectors with stage `kind`.
- Save and Mark applied (editable date, "Did you apply?" prompt).
- The rail with rows.
- Stage pill on result cards and in the detail pane's tracking panel.
- Timeline with status/date/notes editing, an "Advance" quick action, and Undo toasts.
- `lastActivityAt` recorded on every write from day one.

**GIF:** Save a job from search and watch the card badge and rail row appear together. Mark applied. Edit a stage. Refresh persists. List and rail always match.
**Avoids:** Pitfalls 7, 8, 13, 14, 15, 17.

### Phase 4: Stage editing and close-out
**Rationale:** It depends on Phase 3's model. It holds the form and dialog ergonomics and the reorder spike.
**Delivers:**
- Add/remove/rename/reorder with the suggestion picker. Move up/Move down buttons come first; drag is an enhancement if the spike passes.
- Close-out dialog with reasons, reopen, and closed history.
- A failed-stage-to-close prompt, using one shared function.

**GIF:** Build a custom pipeline for one job. Close it as rejected. It leaves the rail but keeps its timeline. Reopen it.
**Avoids:** Pitfall 16 (notes loss, mouse-only reorder).

### Phase 5: Pipeline strip and nudges
**Rationale:** It needs stable `phase()` semantics and dates from Phases 3-4.
**Delivers:**
- The pipeline strip as a rail filter via the URL, with derived, mutually exclusive buckets.
- Response rate with tooltip, hidden under about 3 applied.
- Nudges (gone quiet, upcoming, overdue) with snooze and a needs-attention group.
- The tracked-status search filter.

**GIF:** Click Interviewing and the rail filters. An old applied job shows a quiet nudge and can be snoozed.
**Avoids:** Pitfalls 14, 17. Run the suite under two `TZ` values.

### Phase 6: Ask about this job (streaming chat)
**Rationale:** It is independent of Phases 3-5 and may swap with them. It carries the one genuine stack-rule tension (streaming vs "every fetch through Query"), so it is isolated and needs a decision first.
**Delivers:**
- `/api/chat` streaming and a stream reader in `lib/stream.ts`.
- Optimistic user message, Stop and Retry, and suggested-prompt chips.
- A capped per-job thread.
- Abort propagation to the model on disconnect.

**GIF:** Ask "what would I do in week one?" and watch the answer stream. Stop works. The reply survives a refresh.
**Avoids:** Pitfalls 3, 12.

### Phase 7: Hardening and privacy audit
**Rationale:** This is resilience work that needs everything in place. Each earlier phase still owns its own states and accessibility; this phase verifies them end to end.
**Delivers:**
- Export/import JSON and "clear all my data". Pull these earlier if cheap, but do not drop them, given Safari eviction.
- Cross-tab rehydrate, plus corrupt-storage and quota recovery.
- Missing-key and offline states.
- A full keyboard-only and axe pass.
- Tablet verification at 768/820/1024/1180/1440.
- Playwright flows with AI stubbed.
- Key and log grep audit, and a branding check.

**GIF:** Pull the server key, corrupt localStorage, open two tabs, and the app recovers gracefully.

### Phase Ordering Rationale

- AI comes first because it is the only high-uncertainty item. Its result schema (per-requirement ratings, computed score) constrains the fit UI, cards, cache key and chat context.
- The workspace comes before tracking because cards, detail pane and design system are prerequisites for the tracker's badges and tracking panel.
- Tracking is split into core, editing/close-out, and strip/nudges. That proves the "never disagree" guarantee before richer editing is layered on, and each phase gets a clean GIF.
- Chat comes late because it depends only on the detail pane and AI plumbing, and its streaming decision benefits from a stable app around it.

### Research Flags

Phases likely needing deeper research or spikes (`/gsd-plan-phase --research-phase <N>`):
- **Phase 1: yes.**
  - Spike one real call combining `output_config: { effort, format: zodOutputFormat(...) }` on Sonnet 5.5 and Haiku 5.5.
  - Confirm `parsed_output`, `stop_reason` and cache reads, and measure latency at `medium` effort (target under about 15 s).
  - Then run the PDF corpus through `unpdf` and the document-block fallback.
  - Run `gsd-ai-integration-phase` for the AI design contract.
- **Phase 2:** UI contract (`gsd-ui-phase`) and a palette check against the live LinkedIn jobs page. Only `#0A66C2` and `#004182` are corroborated.
- **Phase 4:** short spike on `@dnd-kit/react` under the React Compiler (keyboard drag, custom announcements). The buttons ship regardless.
- **Phase 6: yes.** Spike the chosen streaming approach through the Vite dev proxy. Confirm no buffering, abort on unmount, and wrong-thread safety.

Standard patterns (skip research-phase): **Phases 3, 5, 7.** Their risk is semantic definition (stage kinds, buckets, response rate, nudge thresholds). That belongs in requirements and tests, not external research.

## Conflicts to resolve in phase planning

The researchers disagree in the places below. Each entry gives both sides and a recommendation. The recommendation is the synthesizer's, not a settled decision. Items marked "needs sign-off" also touch a `stack-conventions` rule.

### 1. Resume PDF handling (Phase 1)

- **STACK:** Server-side text extraction with `unpdf` (and `mammoth` for DOCX). Upload via `express.raw`, with no multipart. Two steps:
  1. Extract returns text, with no AI call.
  2. The user edits the text, then a second call parses it with Haiku.

  The pasted-text path is identical. Scanned PDFs get a 422 and a "paste instead" message. Page cap is about 15.
- **ARCHITECTURE:** No server PDF library at all. The client base64-encodes the file and posts JSON. The server sends the PDF to Claude as a native `document` block with structured output. The server is simpler and layout is handled visually, but the route needs a raised JSON body limit.
- **PITFALLS:** Local extraction first (supports quote verification and is cheap), then a quality gate. The gate checks chars per page, alphabetic ratio, replacement characters and letter-spacing. Fall back to the `document` block only when the gate fails, and ask the model for a transcription so quote verification still has source text. Also: magic-byte check, memory storage, page cap about 6, timeout or worker for CPU-heavy parsing. Mentions `multer` memory storage.
- **Recommendation:** Use STACK's two-step flow with an editable text step as the backbone, plus PITFALLS' quality gate. Treat the `document`-block fallback as a Phase 1 spike item.
  - Build it only if the corpus shows the gate failing on realistic layouts (two-column, sidebar, designer templates). Otherwise ship "paste instead" and defer.
  - Reasons: the editable text is the best defence against extraction and injection errors, it gives one canonical string for hashing and quote verification, and it keeps pasted and uploaded paths identical.
  - Use `express.raw` with a magic-byte check, which has a smaller surface than base64 JSON or multipart.
  - Settle the page cap by measurement (start at about 10).
- **Related sub-conflict:** STACK persists canonical resume text plus profile. ARCHITECTURE persists only the minimised profile and never raw text. Quote verification and cache hashing need the text. Recommend persisting the edited resume text and the reviewed profile (both small, local only), never the PDF, and offering "clear all data".

### 2. Chat streaming transport and Query integration (Phase 6, needs sign-off)

- **STACK:** SSE framing over POST `fetch`, parsed with `eventsource-parser`, consumed through `experimental_streamedQuery` inside a `queryFn`. One query per turn, keyed by turn id. `staleTime: Infinity` and refetch flags off are mandatory, so a focus refetch cannot silently re-run a paid call. The fallback it names is a mutation that calls `setQueryData` per chunk.
- **ARCHITECTURE:** NDJSON (`delta` / `done` / `error` lines), read with `fetch` plus `ReadableStream`. It is appended to a draft in the Query cache from inside a `useMutation`, and committed to the persisted thread on `done`. It rejects `streamedQuery` as still experimental and query-shaped rather than mutation-shaped (a POST with a history).
- **PITFALLS:** Agrees the stream must live inside Query, via `mutationFn` or Query's streaming support. If neither complies, stop and ask.
- **Recommendation:** The mutation plus `setQueryData` draft approach, with NDJSON.
  - It uses stable APIs and matches the POST-with-history shape.
  - It avoids an accidental-refetch hazard on a paid call, drops the `eventsource-parser` dependency, and is the fallback STACK already names.
  - Wrap it in one `lib/stream.ts` plus one hook, so swapping to `streamedQuery` later touches one file.
  - Use a `getReader()` loop. Keep the in-band `done`/`error` protocol, and treat a stream without `done` as incomplete.
- **Chat persistence:** FEATURES and ARCHITECTURE persist a capped per-job thread. STACK says chat is not persisted, and the requirements do not ask for it. Recommend persisting a capped thread (last about 50 messages, last 20 sent) since it is cheap, but it can be cut.

### 3. Rail job data: ids only vs a snapshot on each application (Phases 2-3, needs sign-off)

- **STACK and ARCHITECTURE:** An application stores `jobId` only. The rail resolves display data from Query via a batched `GET /api/jobs?ids=a,b,c` (or `useQueries` on `jobQueries.detail`). This is a literal reading of "never copy server data into Zustand". Seeded jobs never disappear, so a snapshot is unnecessary. Revisit if a real feed arrives. The rail needs the server up to show titles.
- **FEATURES and PITFALLS:** Each application stores a small snapshot of the job (title, company, location, URL). That way it survives a re-seed, id change or delisting, and can render "this listing is no longer available" with history intact. Orphaned applications are described as unrecoverable if snapshots were never stored.
- **Recommendation:** Ids only plus the batched endpoint for v1.
  - A snapshot copies server data into a store, which the rule forbids.
  - The PITFALLS orphan scenario is controlled by a hand-assigned stable seed id scheme, with a test that fails if any known id changes or is removed.
  - Also build a "listing unavailable" rendering path for a missing job, so the application is still viewable, closable and exportable.
  - A snapshot is cheap to add later only if no user data exists yet. If the user wants resilience against future feed changes, decide before Phase 3 ships.
  - Needs user sign-off either way.

### Other disagreements found during synthesis

- **Fit score: model number vs computed.** STACK and ARCHITECTURE schemas have the model return `score` (0-100). PITFALLS says never ship a model-made number. FEATURES also suggests deriving the headline from sub-scores. Recommend per-requirement ratings with the score computed in code, with the job's `requirements[]` fixed in the seed so every run rates the same list. This changes ARCHITECTURE's `FitAnalysis` contract, so settle it before Phase 1 builds on it.
- **Fit analysis calls: one or several.** STACK and FEATURES prefer one call (faster, consistent). PITFALLS prefers a split so the plan and tips are paid for only on demand. ARCHITECTURE says one call, split only if latency demands it. Recommend one call first, and split if the Phase 1 latency measurement misses the target. The data model already groups the pieces, so a split is non-breaking.
- **Analysis cache key and invalidation.**

  | Source | Key | On resume change |
  |---|---|---|
  | STACK | `jobId:resumeHash` | not specified |
  | ARCHITECTURE | `jobId:resumeVersion` (UUID bumped on every save) | prune stale entries |
  | PITFALLS | `(jobId, jobVersion, resumeHash, promptVersion)` | mark stale, do not delete |
  | FEATURES | not specified | show "resume changed, re-check?" |

  Recommend a content hash of the reviewed resume plus `promptVersion` and the job `contentVersion`, marking stale rather than deleting. That keeps the card score honest and avoids surprise cost. A content hash also keeps analyses valid when an unchanged resume is re-saved.
- **Nudge thresholds.** FEATURES: 14 days quiet after Applied, 7 days after an interview stage, 3-day lookahead, snooze 7 days. ARCHITECTURE: 10 days quiet, 3-day lookahead. Recommend FEATURES' values as constants in one config file. This is a requirements decision.
- **Seed size and search.** Seed size: STACK about 300, FEATURES 60-100, PITFALLS 80-150 plus about 15 edge cases. Recommend about 120 generated plus about 15 hand-written edge cases, because variety matters more than count. Search: STACK uses `minisearch`; ARCHITECTURE uses a hand-written weighted token match with no library. Recommend `minisearch` for prefix and fuzzy matching at near-zero cost, unless no new dependency is preferred. Pagination: STACK numbered pages; ARCHITECTURE and FEATURES cursor with Load more. Recommend Load more, which keeps selection stable.
- **Stage reorder.** STACK: `@dnd-kit/react` 0.5.0, with buttons required. ARCHITECTURE: buttons first, drag later. Recommend buttons first, since WCAG 2.5.7 needs them anyway. Add dnd-kit only if the Phase 4 spike passes under the Compiler.
- **Upload limits.** Body cap is 5 MB (STACK), about 8 MB as JSON (ARCHITECTURE), or 5 MB (PITFALLS). Page cap is 15 vs 6. Settle by measurement in Phase 1.

## Stack-convention rules needing user sign-off

`stack-conventions` says to stop and ask rather than work around a rule. None of these has been decided.

1. **Persisting AI results in Zustand vs "never copy server data into Zustand".**
   - Fit analyses, the parsed resume profile, and capped chat threads come from server calls. They are paid, non-deterministic and not refetchable, must outlive Query's `gcTime`, and must be readable synchronously by every result card.
   - All four researchers lean the same way: treat them as user-owned records, written from the mutation's `onSuccess` with context captured in variables.
   - The alternative is `@tanstack/react-query-persist-client`. It adds a package and is built for refetchable data.
   - Recommend the Zustand approach; this needs a yes.
2. **Streaming chat vs "every fetch goes through TanStack Query".** A streaming `fetch` has no clean `useQuery` shape. Both proposed designs keep the fetch inside Query (a `queryFn` with `experimental_streamedQuery`, or a `mutationFn` writing drafts with `setQueryData`). The mutation approach is recommended (conflict 2). Confirm it counts as compliant, since the stream reader is custom code inside `mutationFn`.
3. **URL state without a router.** Search text, filters, selected job and rail filter belong in the URL, so that refresh and back/forward work and search context is never lost. No router is in the fixed stack. Proposed: a roughly 40-line `useSyncExternalStore` helper over `popstate`, `pushState` and `replaceState`. This avoids both a router dependency and a URL-to-store sync effect. Confirm no router is wanted.
4. **`shared/` as an npm workspace package.** The rule requires schemas shared "from one module", while `server/` keeps its own `package.json`. A relative import across packages risks two Zod copies. A root `workspaces` setup that exports TS source directly (no build step) avoids that. Confirm the scaffold's package manager and that a workspace package is acceptable.
5. **Job snapshot on applications** (conflict 3). Either answer is a user decision, because a snapshot literally copies server data into a store.

Also confirm that the scaffold creates the files `stack-conventions` points at, `tsconfig.json` and `src/features/greeting/GreetingForm.tsx` (neither exists yet). Otherwise amend the skill. Also check TypeScript 7.0.2 tooling compatibility at scaffold time.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions, peers and API shapes were verified against the registry, installed type definitions and official docs on 2026-10-10. MEDIUM items: `@dnd-kit/react` under the Compiler, the `eventsource-parser` v4 API (may be dropped), effort plus format in one `output_config`, Haiku 5.5 quality (3 days old), recalled LinkedIn palette values. |
| Features | MEDIUM-HIGH | Table stakes are stable conventions. Competitor specifics were spot-checked or from product knowledge. Thresholds (nudge days, score bands, bucket rules) are researcher judgement, listed as open decisions. |
| Architecture | HIGH structure, MEDIUM AI | State ownership, data model, patterns and build order follow from the fixed stack and PROJECT.md. PDF limits, structured-output latency and the streaming wire format are unverified until Phases 1 and 6. |
| Pitfalls | MEDIUM | Claude API behaviours are HIGH (bundled skill, cached 2026-09-25, may predate Haiku 5.5). PDF extraction, storage, accessibility and date items are established engineering knowledge, not re-verified live. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Fit analysis latency and quality:** unmeasured. Phase 1 must record latency at `medium` effort and decide between one call and a split. Adjust effort or model if over about 15 s.
- **Haiku 5.5 for resume parsing:** released 2026-10-07 with no evidence yet. Keep the model id in config and fall back to Sonnet 5.5 if parse quality disappoints.
- **`output_config` carrying both `effort` and `format`:** docs and SDK types disagree. Confirm in the first spike.
- **Prompt-cache value and minimum prefix:** prefixes of about 3K tokens save fractions of a cent, and the real gain is chat latency. Verify `cache_read_input_tokens`, keep it to a few lines, and do not architect around it. Sonnet 5.5's minimum prefix comes from a bundled skill and is not confirmed.
- **PDF extraction on real layouts:** assemble a 5-8 file synthetic corpus in Phase 1 before deciding whether to build the document-block fallback.
- **Requirement list per job:** Phase 1 must decide whether `requirements[]` is authored in the seed or extracted once at seed time. The code-computed score depends on it being stable.
- **Metric and threshold definitions:** pipeline buckets, response rate, nudge thresholds, fit score bands, and whether a failed stage prompts close must be written into requirements before Phases 3 and 5.
- **Palette and fonts:** only two brand values are corroborated. Sample the live jobs page during Phase 2 and check contrast of every token.
- **Safari storage eviction (7 days idle):** real for a sporadically used tracker. Mitigate with `navigator.storage.persist()` and export/import, and verify behaviour for installed web apps.
- **`@dnd-kit/react` with the React Compiler:** no documentation found. Spike in Phase 4.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-10-10): all package versions, peers, engines, publish dates
- Installed `@anthropic-ai/sdk@0.133.0` and `@tanstack/query-core@5.104.1` contents: `zodOutputFormat`, `messages.parse`, `output_config.effort`, `experimental_streamedQuery`
- platform.claude.com docs (models overview, Haiku 5.5, structured outputs, Haiku 5.5 prompting guide): model ids, prices, limits, refusal behaviour
- Context7: `/pmndrs/zustand` (persist), `/tanstack/query` (streamedQuery), `/unjs/unpdf`, `/colinhacks/zod`, `/websites/tailwindcss`
- MDN storage quotas and eviction criteria; WebKit ITP 7-day rule
- `.planning/PROJECT.md` and `.claude/skills/stack-conventions/SKILL.md`: constraints and rules

### Secondary (MEDIUM confidence)
- Bundled claude-api skill reference (cached 2026-09-25): Sonnet 5.5 migration notes, PDF `document` block limits, caching placement and invalidators
- Context7 `/clauderic/dnd-kit` and dndkit.com migration guide: no React Compiler guidance found
- Competitor spot-checks (Huntr, Teal, Jobscan, LinkedIn Job Tracker, Indeed My Jobs) via review and help pages
- Brand-colour listings for `#0A66C2` and `#004182`

### Tertiary (LOW confidence, needs validation)
- Recalled LinkedIn palette values (canvas, ink, success, danger) and font-stack list
- Researcher-judgement thresholds (nudge days, score bands, bucket rules)
- General engineering knowledge on PDF extraction failure modes, accessibility patterns and trademark practice

---
*Research completed: 2026-10-10*
*Ready for roadmap: yes, after the sign-offs listed above (or with them recorded as open decisions)*
