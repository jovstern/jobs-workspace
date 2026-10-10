# Architecture Research

**Domain:** Single-user, LinkedIn-style jobs workspace (search + application tracker + AI fit analysis)
**Researched:** 2026-10-10
**Confidence:** HIGH on structure, state ownership and data model (derived directly from the fixed stack and PROJECT.md). MEDIUM on AI API specifics (PDF limits, structured-output latency, streaming wire format) — these must be confirmed by the first phase, which is exactly why that phase exists.

> Scope note: the repo is empty (only `.planning/` and `.claude/`). `stack-conventions` points at `tsconfig.json` and `src/features/greeting/GreetingForm.tsx`, neither of which exists yet. The scaffold is therefore part of Phase 1, and the greeting example must be created or the pointer fixed.

## Standard Architecture

### System Overview

```
┌──────────────────────────────── BROWSER (Vite + React) ────────────────────────────────┐
│  URL search params  (q, filters, sort, job, pipeline)   <- navigation/selection state   │
│        │ parsed by Zod in src/lib/urlState.ts, read ONLY by features/workspace          │
│        v                                                                                │
│  ┌──────────────────────── features/workspace  (composition only) ──────────────────┐   │
│  │  SearchPane            DetailPane                       Rail                      │   │
│  │  job-search            job-detail                       applications + pipeline   │   │
│  │   SearchBar/Filters     Overview | My fit | Ask          PipelineStrip, Nudges    │   │
│  │   ResultsList/JobCard   ApplicationPanel (timeline)      ApplicationList          │   │
│  └───────┬──────────────────────┬───────────────────────────────┬───────────────────┘   │
│          │ props (selectedId,   │                               │                       │
│          │ query)               │                               │                       │
│  ┌───────v──────────────────────v───────────────────────────────v───────────────────┐   │
│  │ DOMAIN FEATURES (public API via index.ts only)                                    │   │
│  │  jobs (server data)   applications   resume   fit-analysis   job-chat            │   │
│  └───────┬───────────────────┬───────────┬──────────┬──────────────┬─────────────────┘   │
│          │ TanStack Query    │ Zustand + persist (localStorage, Zod-validated)         │   │
│          │ (server data)     │  applications | resume | analyses | chat                 │   │
│          v                   v                                                         │
│  src/lib/api.ts  (apiFetch: fetch + Zod parse + ApiError)       src/lib/stream.ts      │
└──────────┼──────────────────────────────────────────────────────────────────────────────┘
           │  same-origin  /api/*   (Vite dev proxy -> 127.0.0.1:3001; prod: Express serves dist/)
           │  request/response shapes = shared/ contracts (ONE Zod module, imported by both sides)
┌──────────v────────────────── SERVER (stateless Express, server/) ──────────────────────┐
│  routes (thin)  ->  validate(Zod) middleware  ->  services  ->  error middleware         │
│   GET  /api/health          {ok, aiConfigured}                                           │
│   GET  /api/jobs            search + filter + paginate over seed                         │
│   GET  /api/jobs/:id        full Job                                                     │
│   POST /api/resume/parse    {kind:'pdf'|'text'} -> ResumeProfile   (nothing stored)      │
│   POST /api/fit             {jobId, profile} -> FitAnalysis                              │
│   POST /api/chat            {jobId, messages, profile?} -> NDJSON stream                 │
│  services/jobs: seed repo (in-memory, Zod-validated at boot)                             │
│  services/ai:   Anthropic SDK client + prompts + schemas   <-- ANTHROPIC_API_KEY lives  │
└──────────────────────────────────────────────────────┬──────────────────────────────────┘
                                                       v
                                              Anthropic Messages API
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `shell` | LinkedIn-like chrome: top nav (inert items except Jobs), resume chip/entry point, toaster, tooltip provider | Plain components + Radix; no data logic |
| `workspace` | Owns the URL state, lays out the three panes, passes `selectedId`/`query`/`pipeline` down as props. The only feature that reads URL params | Composition component + `useWorkspaceParams()` |
| `jobs` | Server-data layer for jobs: `queryOptions` factories (`search`, `detail`), API calls, re-exported Job schemas, `CompanyAvatar` | TanStack Query; no UI beyond tiny atoms |
| `job-search` | Search bar, filters, results list, `JobCard` | TanStack Form (search), Radix Select/Popover (filters), `useInfiniteQuery` |
| `job-detail` | Selected job view with tabs Overview / My fit / Ask; hosts the panels from other features | Radix Tabs, `useSuspenseQuery(jobQueries.detail(id))` |
| `applications` | THE source of truth for tracked jobs: store, pure model functions (stage ops), pure selectors (phase, current stage, response rate), `ApplicationPanel` + `StageTimeline` + close-out dialog, `TrackedBadge` | Zustand (persisted) + pure TS |
| `pipeline` | Pipeline summary strip, needs-attention nudges, rail list composition | Pure selectors from `applications`; renders only |
| `resume` | Intake dialog (PDF/paste), review/edit parsed profile, persisted `StoredResume` with `version` | TanStack Form + `useMutation` + Zustand (persisted) |
| `fit-analysis` | "Check my fit" mutation, persisted analyses cache keyed by job+resume version, FitPanel, `useFitScore(jobId)` for cards | `useMutation` + Zustand (persisted) |
| `job-chat` | Per-job thread UI, streaming consumption, persisted threads | `useMutation` + stream reader + Zustand (persisted) |
| `server/` | Seeded jobs, three AI proxy endpoints, key custody, validation, error mapping. Holds zero user data | Express + TS + Zod + `@anthropic-ai/sdk` |
| `shared/` | Zod request/response contracts (the one module both sides import) | npm workspace package, TS source exported directly |

## Recommended Project Structure

```
package.json                  # root: workspaces ["server", "shared"]
shared/
  package.json                # name "@jobs/contracts"; "exports": {".": "./src/index.ts"}; zod as peerDependency
  src/
    index.ts                  # re-exports everything below
    job.ts                    # JobSchema, JobSummarySchema, JobSearchQuerySchema, JobSearchResponseSchema, enums
    resume.ts                 # ResumeProfileSchema, ParseResumeRequestSchema (discriminated union), response
    fit.ts                    # FitAnalysisSchema, FitRequestSchema, FitResponseSchema
    chat.ts                   # ChatRequestSchema, ChatStreamEventSchema (delta | done | error)
    errors.ts                 # ApiErrorSchema + ApiErrorCode enum
server/
  package.json                # own package.json (per stack-conventions); depends on @jobs/contracts
  .env.example                # ANTHROPIC_API_KEY=, AI_MODEL_*, PORT
  src/
    index.ts                  # listen on 127.0.0.1
    app.ts                    # createApp(deps) — deps injectable so tests pass a fake AI client
    env.ts                    # Zod-parsed process.env; fails fast; exposes aiConfigured
    middleware/validate.ts    # validate({params, query, body}) -> typed req; 400 with ApiError
    middleware/errors.ts      # maps ApiError/Anthropic errors/ZodError to ApiErrorSchema JSON
    routes/{health,jobs,resume,fit,chat}.ts
    services/jobs/{repo,search}.ts + data/jobs.seed.ts
    services/ai/{client,resume,fit,chat}.ts + prompts/*.ts
src/
  main.tsx, App.tsx           # providers: QueryClient, error boundary, Radix Tooltip/Toast, ResumeDialog context
  components/                 # shared UI only: Button, Badge, Dialog, Select, Tabs, Toast wrappers over Radix
  lib/
    api.ts                    # apiFetch(schema, path, init) -> parsed data | throws ApiError
    stream.ts                 # NDJSON async-iterator reader, Zod-parses each event
    urlState.ts               # useUrlParams(schema) over useSyncExternalStore(popstate)
    persist.ts                # createPersistedStore(): Zustand persist + Zod validate + versioned migrate + corrupt backup
    useNow.ts                 # useSyncExternalStore clock (render stays pure)
  features/
    shell/  workspace/
    jobs/            queries.ts  api.ts  CompanyAvatar.tsx  index.ts
    job-search/      SearchBar.tsx  Filters.tsx  ResultsList.tsx  JobCard.tsx  searchParams.ts
    job-detail/      JobDetail.tsx  JobOverview.tsx
    applications/    schema.ts  model.ts  selectors.ts  store.ts  hooks.ts  index.ts
                     ApplicationPanel.tsx  StageTimeline.tsx  StageEditor.tsx  CloseOutDialog.tsx  TrackedBadge.tsx
    pipeline/        PipelineStrip.tsx  Nudges.tsx  ApplicationsRail.tsx  ApplicationRow.tsx
    resume/          schema.ts  store.ts  mutations.ts  ResumeDialog.tsx  ResumeChip.tsx  replaceResume.ts
    fit-analysis/    schema.ts  store.ts  mutations.ts  FitPanel.tsx  FitScoreBadge.tsx  index.ts
    job-chat/        schema.ts  store.ts  mutations.ts  ChatPanel.tsx
e2e/                          # Playwright; AI endpoints stubbed via route interception
```

### Structure Rationale

- **`shared/` as an npm workspace, not a relative `../` import.** A relative import from `server/` into `src/` (or a top-level folder without its own resolution root) resolves `zod` from whichever node_modules is nearest — you get two Zod copies, or a missing one. Workspaces hoist one Zod, and the server still has its own `package.json` as the stack requires. Export TS source directly (no build step): Vite bundles it for the client, `tsx` runs it for the server. Add `@jobs/contracts` aliases via workspace resolution, not path hacks. Use pnpm/npm equivalent per whatever the scaffold picks. (MEDIUM — Phase 1 verifies it in its first hour.)
- **Wire schemas in `shared/`, client-only persisted schemas in their feature.** `Application`, `Stage`, `CloseOut`, `ChatThread` never cross the wire, so they live in `features/*/schema.ts` and exist to validate localStorage on rehydrate. `ResumeProfile` and `FitAnalysis` are wire types in `shared/` that the client wraps with metadata (`version`, `resumeVersion`, timestamps).
- **Layering with enforced public APIs.** Direction is strictly `shell → workspace → {job-search, job-detail, pipeline} → {applications, resume, fit-analysis, job-chat} → jobs → lib`. Domain features never import UI features. Cross-feature imports go through `index.ts` only (lint `no-restricted-imports` on `features/*/!(index)`), so `job-search` can show a tracked badge without reaching into `applications` internals.
- **Pure logic split from React.** `model.ts` (stage operations) and `selectors.ts` (phase, nudges, response rate) are plain TypeScript with unit tests. This is the highest-logic area of the app and the place where "list and rail disagree" bugs would be born.

## Data Model

Persisted client records are Zod-validated on rehydrate. Types come from `z.infer` (stack rule).

```ts
// ---------- server data (shared/src/job.ts) — TanStack Query only, never in a store ----------
Job = {
  id: string; title: string;
  company: { name: string; hue: number };       // avatar derived from name+hue; no trademarked logos
  location: string; workplace: 'onsite'|'hybrid'|'remote';
  employmentType: 'full_time'|'contract'|'part_time'|'internship';
  seniority: 'intern'|'junior'|'mid'|'senior'|'staff'|'lead';
  salary?: { min: number; max: number; currency: string };
  postedAt: string;                              // ISO
  description: string; responsibilities: string[]; requirements: string[]; skills: string[];
}
JobSummary = Pick<Job, 'id'|'title'|'company'|'location'|'workplace'|'employmentType'|'seniority'|'salary'|'postedAt'|'skills'>

// ---------- client-owned, persisted (features/applications/schema.ts) ----------
StageStatus = 'upcoming'|'in_progress'|'passed'|'failed'|'skipped'
StageKind   = 'saved'|'applied'|'screen'|'interview'|'offer'|'custom'   // survives renaming; drives pipeline phase
Stage = { id: string; name: string; kind: StageKind; status: StageStatus;
          date: string | null /* YYYY-MM-DD */; notes: string }
          // ORDER = array index in Application.stages. No separate `order` field: two sources of truth drift.
CloseOut = { outcome: 'rejected'|'withdrew'|'offer_accepted'|'offer_declined'|'no_reply';
             closedAt: string; note?: string }
Application = { jobId: string /* identity: one application per job */;
                createdAt: string; updatedAt: string; stages: Stage[]; closeOut?: CloseOut }
// Store shape: { byJobId: Record<string, Application> }   (jobId only — NO job fields copied in)

// ---------- resume (wire: shared/src/resume.ts; stored: features/resume/schema.ts) ----------
ResumeProfile = { name?: string; headline: string; summary: string; yearsExperience?: number;
                  skills: { name: string; level?: 'beginner'|'intermediate'|'advanced' }[];
                  experience: { title: string; company: string; start: string; end?: string; highlights: string[] }[];
                  education: { school: string; degree?: string; year?: string }[];
                  certifications: string[] }
          // Deliberately NO email/phone/address: data minimisation. The AI never needs them.
StoredResume = { version: string /* crypto.randomUUID(), bumped on every save incl. manual edits */;
                 profile: ResumeProfile; sourceName?: string; savedAt: string }
          // The PDF itself is NEVER stored client- or server-side; only the parsed profile.

// ---------- fit (wire: shared/src/fit.ts; stored: features/fit-analysis/schema.ts) ----------
FitAnalysis = { score: number /* 0-100 */; summary: string;
                strengths: { title: string; evidence: string }[];
                gaps: { skill: string; importance: 'critical'|'important'|'nice_to_have'; why: string;
                        learning: { whatToLearn: string; effort: string } }[];   // learning plan lives on the gap
                tailoring: { emphasise: string[]; missingKeywords: string[]; tips: string[] } }
StoredFitAnalysis = FitAnalysis & { jobId: string; resumeVersion: string; analysedAt: string }
// Store shape: { byKey: Record<`${jobId}:${resumeVersion}`, StoredFitAnalysis> }
// Score band ("strong/good/partial/weak") is DERIVED from score in render, never stored or model-generated.

// ---------- chat (features/job-chat/schema.ts) ----------
ChatThread = { jobId: string; updatedAt: string;
               messages: { id: string; role: 'user'|'assistant'; content: string; createdAt: string }[] }
// Store shape: { byJobId: Record<string, ChatThread> }, capped (last 50 messages/thread, last 20 sent to the server)
```

**Derived, never stored** (pure functions in `applications/selectors.ts`, all taking `now` as a parameter):

- `phase(app)`: `closed` if `closeOut`; else `offer` if any `kind:'offer'` stage is `in_progress|passed`; else `interviewing` if any stage after the `applied` stage with kind `screen|interview|custom` is `in_progress|passed`; else `applied` if the `applied` stage is `passed|in_progress`; else `saved`. Classification keys off `kind`, so renaming "Technical interview" to "Pairing session" cannot break the pipeline counts.
- `currentStage(app)`: first `in_progress`, else the last `passed`, else first `upcoming`.
- `pipelineCounts(apps)`, `responseRate(apps)` (responded / applied, where responded = any post-applied stage touched, or a closed outcome other than `no_reply`).
- `nudges(apps, now)`: "gone quiet" = open `applied`+ application whose last activity (max of `updatedAt`, past stage dates) is older than N days (default 10, constant in one place); "coming up" = stage with a `date` within the next 3 days and status `upcoming|in_progress`.

## Architectural Patterns

### Pattern 1: One application store, many derived views ("never disagree")

**What:** `useApplicationsStore` (Zustand + persist) holds `byJobId`. The result card and the rail both read it through the same two hooks exported from `applications/index.ts`, and both compute display state with the same `phase()`/`currentStage()` selectors. There is no second copy of status anywhere (no `status` field on Application, no counts in a store).
**When to use:** Always for tracked state. This is the architectural answer to the core-value requirement.
**Trade-offs:** Derivation runs on every render; with tens of applications the React Compiler plus plain functions make this free. If it ever mattered, memoise inside the selector module, not in components.

```ts
// features/applications/hooks.ts
export function useApplication(jobId: string): Application | undefined {
  return useApplicationsStore((s) => s.byJobId[jobId]);        // stable reference, safe selector
}
export function useApplications(): Application[] {
  const byJobId = useApplicationsStore((s) => s.byJobId);       // select the stable record...
  return Object.values(byJobId);                                // ...derive in render (compiler handles it)
}
// WRONG in Zustand v5: useStore((s) => Object.values(s.byJobId)) — new array each call
// => "getSnapshot should be cached" infinite re-render. Use the pattern above or useShallow.
```

```tsx
// JobCard (job-search) and ApplicationRow (pipeline) both do:
const app = useApplication(job.id);
const label = app ? stageLabel(app) : null;     // same function => same text in both places
```

### Pattern 2: URL owns navigation state; stores own user data; Query owns server data

**What:** Search text, filters, sort, selected job and rail pipeline filter live in URL search params (`?q=react&workplace=remote&level=senior&job=j_042&pipeline=interviewing`). Parsed with a Zod schema (`.catch(default)` per field so a hand-edited URL never crashes), read in exactly one place (`useWorkspaceParams()` in `workspace`), and passed to children as props. Not in Zustand.
**Why:** Refresh, back/forward and copy-link all work for free; it directly serves the core value ("never lose search context"); and there is no URL-to-store sync effect to get wrong (effects for deriving state are banned anyway).
**No router needed.** The app is one screen. `src/lib/urlState.ts` is ~40 lines: `useSyncExternalStore` subscribed to `popstate` plus a `setParams(patch, {replace})` that calls `history.pushState/replaceState` and dispatches a custom event. That is a legitimate "sync with the browser" use. Adding a router library is not forbidden by the stack but is unnecessary; if the roadmap wants one, ask first.
**Rules:** push for job selection and filter changes (back button steps through them); replace for keystroke-level changes. Search text is a TanStack Form field committed to `?q=` on submit; filters commit on change inside `startTransition` so the old list stays interactive. Open dialogs and unsaved form drafts are local state, not URL.
**Selected job fallback is derived, not stored:** `const selectedId = params.job ?? results[0]?.id`.
**Rail click selects without touching search:** clicking an application sets only `job=`; the results list, filters and scroll position are untouched. The detail pane loads from `jobQueries.detail(id)`, so the selected job need not be in the current results page.

### Pattern 3: Store holds `jobId`; display data comes from the Query cache

**What:** `Application` references `jobId` only. The rail renders rows via `useQueries(applications.map(a => jobQueries.detail(a.jobId)))` (or `useSuspenseQueries`), which shares cache entries with the detail pane. When search results load, seed `jobQueries.detail` caches from `JobSummary` only if the full `Job` is absent — or simply let the detail query fetch; seed data is static so use `staleTime: Infinity`.
**Why:** Stack rule "never copy server data into Zustand or useState". Cost: the rail needs the server up to show titles. For a local app whose AI features need the server anyway, that is acceptable.
**Decision flag (see Open Decisions):** if a real feed ever replaces the seed, jobs can expire and the rail would show holes; then add a small user-owned `jobRef` snapshot (title, company) to Application deliberately.

### Pattern 4: Persisted client-owned stores via one helper, validated on rehydrate

**What:** `createPersistedStore()` wraps Zustand `persist` + `createJSONStorage(() => localStorage)` with `name: 'jw:v1:<concern>'`, an explicit `version` and `migrate`, `partialize` (actions are never persisted), and a Zod parse in `merge`. On parse failure it copies the raw string to `jw:v1:<concern>:corrupt` and starts empty (and the shell shows a toast) rather than silently discarding the user's only copy.
**Hydration:** localStorage is synchronous, so persisted stores hydrate before first render — no loading flash and no `_hasHydrated` gating. (Zustand docs describe `skipHydration`/`onRehydrateStorage` for async storage; not needed here.)
**Four small stores, one per concern:** `applications`, `resume`, `fitAnalyses`, `chat`. Cross-store orchestration is a plain function in the owning feature, not a store that knows about others:

```ts
// features/resume/replaceResume.ts
export function replaceResume(profile: ResumeProfile, sourceName?: string) {
  const version = crypto.randomUUID();
  useResumeStore.getState().save({ version, profile, sourceName, savedAt: new Date().toISOString() });
  useFitStore.getState().pruneExcept(version);       // stale analyses cannot score cards
}
```

**Cross-tab:** `persist` does not sync tabs; a second tab will overwrite the first on its next write. Subscribe to the `storage` event and call `store.persist.rehydrate()` (an effect syncing with a browser API — allowed). Handle in the hardening phase.
**Budget:** ~5 MB localStorage. Applications (KBs), resume profile (~5 KB), analysis (~3-6 KB each, prune beyond ~150), chat (capped). The PDF is never persisted. Comfortable.

### Pattern 5: AI results are user-owned artifacts written by mutation `onSuccess`

**What:** Fit analysis and parsed resume are produced by `useMutation` (all fetches go through Query) and, on success, written into their persisted stores. Components read the store, never `mutation.data`, so a card elsewhere on the page updates when the result lands.
**Race safety:** everything needed to file the result is captured in the mutation variables, never read from "current" state at completion time. Hook-level `onSuccess` (in `useMutation` options) still fires after the component unmounts, whereas callbacks passed to `mutate()` do not — so use the options form. A user can start a fit check, switch jobs, replace the resume, and the result still files under the correct `jobId:resumeVersion` (and is simply never read if that version is gone).

```ts
// features/fit-analysis/mutations.ts
type FitVars = FitRequest & { resumeVersion: string };        // resumeVersion is client-only, not sent
export function useCheckFit() {
  const put = useFitStore((s) => s.put);
  return useMutation({
    mutationKey: ['fit', 'run'],
    mutationFn: ({ jobId, profile }: FitVars) =>
      apiFetch(FitResponseSchema, '/api/fit', { method: 'POST', body: { jobId, profile } }),
    onSuccess: (analysis, v) =>
      put({ ...analysis, jobId: v.jobId, resumeVersion: v.resumeVersion, analysedAt: new Date().toISOString() }),
  });
}
// Card spinner for in-flight jobs: useIsMutating({ mutationKey: ['fit','run'], predicate: m => m.state.variables?.jobId === id })
```

### Pattern 6: Contract-first, validate at every boundary, services behind routes

**What:** `shared/` is written before either side. The server's `validate({ params, query, body })` middleware parses with the shared schema and the response is built from shared types; the client's `apiFetch(schema, ...)` re-parses the response. Routes are 5-line adapters; logic lives in `services/`. `createApp({ ai })` takes an AI client interface so tests inject a fake and never spend tokens.

```ts
// server/src/routes/fit.ts
router.post('/fit', validate({ body: FitRequestSchema }), async (req, res) => {
  const job = jobs.byId(req.body.jobId) ?? throwApi('not_found');       // job text comes from the SERVER seed,
  res.json(await ai.analyseFit(job, req.body.profile));                   // never from the client
});
```

### Pattern 7: Streaming chat as a mutation that writes a draft into the Query cache

**What:** `POST /api/chat` returns `application/x-ndjson`, one JSON event per line: `{type:'delta',text}`, `{type:'done'}`, `{type:'error',code,message}`. The client reads it with `fetch` + `ReadableStream` (EventSource is GET-only), Zod-parses each line (`src/lib/stream.ts`), and the `useMutation` `mutationFn` appends each delta to a draft held in the Query cache (`setQueryData(chatKeys.draft(jobId), …)`), read by the panel through a tiny `useChatDraft(jobId)` hook. On `done`, `onSuccess` commits the finished assistant message to the persisted thread and clears the draft. The user message is appended to the thread optimistically at send time. A half-streamed reply is therefore never persisted.
**Why not `experimental_streamedQuery`:** still experimental in the 5.x docs, and query-shaped (keyed fetch) rather than mutation-shaped (POST with a history). Revisit once stable.
**Server:** `client.messages.stream({...})` with `.on('text', delta => res.write(...))`; on `req.on('close')` call `stream.abort()` so a closed tab stops spending tokens; errors after headers are sent are delivered as an `error` event, not a status code. Client "Stop" uses an `AbortController` held in the mutation variables.

## Data Flow

### State ownership map

| State | Owner | Persisted | Read by |
|-------|-------|-----------|---------|
| Job listings, job detail | TanStack Query (`jobs`) | No (re-fetchable) | job-search, job-detail, pipeline rows |
| Search text, filters, sort, selected job, rail filter | URL params (`workspace` reads) | URL | props down to panes |
| Applications, stages, close-out | Zustand `applications` | localStorage | JobCard, ApplicationPanel, rail, strip, nudges |
| Resume profile + `version` | Zustand `resume` | localStorage | ResumeChip, FitPanel, ChatPanel (optional) |
| Fit analyses | Zustand `fitAnalyses` | localStorage | FitPanel, JobCard (`useFitScore`) |
| Chat threads | Zustand `chat` | localStorage (capped) | ChatPanel |
| In-flight chat reply | Query cache draft | No | ChatPanel |
| Dialog open/closed, unsaved form drafts | `useState` / context (`ResumeDialog` opener via app-level context) | No | local |

### Key Data Flows

1. **Search and browse.** User types and submits (or toggles a filter) -> `setParams` updates URL -> `useWorkspaceParams()` re-parses -> `ResultsList` receives `query` -> `useInfiniteQuery(jobQueries.search(query))` with `placeholderData: keepPreviousData` -> `GET /api/jobs?...&cursor=` -> `apiFetch` Zod-parses -> cards render. Each card calls `useApplication(job.id)` and `useFitScore(job.id)` for its badge. "Load more" requests the next cursor.
2. **Open a job.** Click card (or rail row) -> `setParams({job: id})` -> `JobDetail` -> `useSuspenseQuery(jobQueries.detail(id))` (shared cache with rail). Search list is untouched.
3. **Save / Mark as applied.** Button in `ApplicationPanel` -> `applications.track(jobId)` creates the template (Saved `passed` with today's date, Applied `upcoming`, Recruiter screen, Technical interview, Final round, Offer, each with its `kind`) / `markApplied(jobId)` sets Applied `passed` + date (creating the application first if absent) -> store emits -> card badge, detail panel, rail row, strip counts and nudges all re-derive in the same render pass. Optimistic by nature: no network.
4. **Edit stages.** Stage actions (`addStage`, `removeStage`, `renameStage`, `moveStage`, `updateStage`) call pure functions in `model.ts` and set `byJobId[jobId]` and `updatedAt`. Suggested stages (Take-home, System design, HR call, Reference check, ...) are a constant list that maps to `kind`; free text becomes `kind:'custom'`. Reorder uses Radix-free keyboard-accessible up/down controls first; drag can be a later enhancement.
5. **Close out / reopen.** `closeApplication(jobId, outcome, note)` sets `closeOut`; derived `phase` becomes `closed`, the application leaves the active rail list and appears under the `closed` strip filter with its full timeline. `reopen` clears `closeOut`.
6. **Pipeline strip / nudges.** Strip click -> `setParams({pipeline})` -> rail filters `useApplications()` by `phase()`. Nudges computed from `useApplications()` + `useNow()`; clicking a nudge sets `job=`.
7. **Resume intake.** Dialog (TanStack Form + Zod: PDF <= limit, or text >= min length) -> `parseResume` mutation: file -> base64 (`FileReader` promise) -> `POST /api/resume/parse {kind:'pdf', data, filename}` or `{kind:'text', text}` -> server validates, sends the base64 PDF straight to Claude as a `document` content block (stable, non-beta in the SDK) or the text, with structured output constrained to `ResumeProfileSchema` -> returns profile, stores nothing, logs no bodies -> dialog shows an editable review step (AI parse is imperfect) -> Save -> `replaceResume()` -> new `version`, stale analyses pruned -> `ResumeChip` updates. No server-side PDF library is needed.
8. **Check my fit.** FitPanel gates on state: no resume -> CTA opens ResumeDialog; resume but no analysis for `jobId:version` -> "Check my fit"; in flight -> skeleton with honest "usually 10-30 s"; done -> render from store; error -> retry. Click -> `useCheckFit().mutate({jobId, profile, resumeVersion})` -> `POST /api/fit {jobId, profile}` -> server loads the job from its seed, builds the prompt, `messages.parse` with `zodOutputFormat` -> `FitAnalysis` -> `onSuccess` writes to `fitAnalyses` -> panel and the job's result card (score chip) update. Learning plan and tailoring tips render from the same cached object, so tabs cost nothing extra.
9. **Ask about this job.** Send -> optimistic user message in thread -> stream mutation (Pattern 7) with `{jobId, messages: last 20, profile?}` -> server loads job context from seed, streams deltas -> draft renders token by token -> `done` commits the assistant message. Refresh mid-stream loses only the unfinished reply.
10. **App load.** Stores hydrate synchronously from localStorage (Zod-validated); URL is parsed; queries fire; `GET /api/health` tells the UI whether `aiConfigured` so missing-key state shows an actionable message instead of a generic 500.

### API contracts (all in `shared/`)

| Endpoint | Request | Response | Notes |
|----------|---------|----------|-------|
| `GET /api/jobs` | query: `q, location, workplace[], type[], level[], posted(24h/7d/30d), sort(relevance/date), cursor, limit` | `{items: JobSummary[], total, nextCursor|null}` | Search = simple weighted token match over title/company/skills/description in `services/jobs/search.ts`; no search library. Cursor = opaque offset over stable seed order |
| `GET /api/jobs/:id` | param | `Job` | 404 -> `not_found` |
| `GET /api/health` | - | `{ok, aiConfigured}` | Never reveals the key |
| `POST /api/resume/parse` | `{kind:'pdf', data(base64), filename} | {kind:'text', text}` | `{profile}` | JSON body limit raised on this route only (~8 MB); client pre-checks size. Non-resume input -> `unparseable_resume` |
| `POST /api/fit` | `{jobId, profile}` | `FitAnalysis` | Timeout ~60 s; non-streaming structured output |
| `POST /api/chat` | `{jobId, messages[], profile?}` | NDJSON of `ChatStreamEvent` | Abort on client disconnect |
| any error | - | `{error:{code, message, details?}}` | Codes: `validation_error, not_found, ai_not_configured, ai_upstream_error, ai_rate_limited, payload_too_large, unparseable_resume` |

Model-output schemas used with structured outputs may need to be looser than API schemas (structured-output JSON Schema subsets can reject constraints like numeric min/max or string lengths). Keep a `FitModelOutputSchema` in `server/services/ai` if so, and have the route re-validate against the strict shared `FitAnalysisSchema` before responding. Confirm in Phase 1.

### API key handling

- `ANTHROPIC_API_KEY` is read only in `server/src/env.ts` (Zod-parsed `process.env`), supplied via a git-ignored `.env` (`.env.example` committed). Load with `node --env-file` / `tsx --env-file` (no extra dependency).
- Never use a `VITE_` prefix; the client has no env var for it. Add a build check that greps `dist/` for `sk-ant` and fails.
- Server binds `127.0.0.1` so nobody else on the network can spend the key. Same-origin via Vite dev proxy means no CORS config at all. For a built run, Express serves `dist/` from the same process.
- `aiConfigured` boolean exposed via `/api/health`; routes return `ai_not_configured` (503) when the key is absent so the UI can show setup help.
- Do not log request bodies (resumes) or the key; log route, status, latency, model, token usage.
- Model IDs come from env (`AI_MODEL_PARSE`, `AI_MODEL_ANALYSIS`, `AI_MODEL_CHAT`) with defaults, so cost/latency can be tuned without code changes (a faster tier for parse and chat, a stronger one for analysis, if the spike shows a need).
- Set SDK `maxRetries` (2) and an explicit timeout; cap `max_tokens` per endpoint.

## Suggested Build Order

Principle: prove the riskiest unknown first, and make every phase end in something a short GIF can show. Contracts are written at the start of each phase so server and client halves can proceed in parallel.

```
Phase 1  Scaffold + REAL AI PATH (resume -> profile -> fit)
   needs: nothing
Phase 2  Jobs API + three-pane workspace + search/filter/detail (URL state, LinkedIn shell, design tokens)
   needs: 1 (server, contracts, apiFetch, FitPanel, resume store)
Phase 3  Applications core: save / mark applied / rail / stage on cards / read+edit timeline basics
   needs: 2 (cards, detail pane, jobId resolution)
Phase 4  Stage editing (add/remove/rename/reorder + suggestions) and close-out/reopen
   needs: 3 (store + model)
Phase 5  Pipeline strip, response rate, nudges
   needs: 3-4 (phase() semantics and dates)
Phase 6  Job chat (streaming)
   needs: 2 (detail pane) + 1 (AI plumbing); independent of 3-5, may swap with 4-5
Phase 7  Hardening: corrupt/quota/cross-tab storage, error states, empty states, a11y pass, e2e flows
   needs: all
```

| # | Phase | Visibly working in the browser | Retires |
|---|-------|--------------------------------|---------|
| 1 | **Scaffold + real AI vertical slice.** Vite/React/Compiler, Tailwind, `shared/` workspace, Express with `validate`, `env`, `/health`, `/resume/parse`, `/fit`; ~5 hand-written seed jobs and `/jobs/:id`; `createPersistedStore`; `resume` and `fit-analysis` features with real (plain-styled) `ResumeDialog` and `FitPanel` on a stub page with a job picker | Upload a real PDF (or paste) -> see parsed, editable profile -> pick a seed job -> Check my fit -> score, strengths, gaps, learning plan, tailoring tips -> refresh and everything is still there -> re-upload and the old analysis is gone | PDF-to-Claude path and limits, structured-output reliability and latency, prompt quality, key custody, shared-contract layout, persist+Zod rehydrate |
| 2 | **Workspace.** Full seeded dataset (~60-100 varied jobs), search/filter/pagination, URL state, three-pane layout with an inert rail placeholder, LinkedIn shell and top nav, JobCard, JobDetail with tabs (Overview / My fit hosting Phase 1's panel), fit score chip on analysed cards | Search, filter, load more, select jobs, refresh keeps context, run a fit check and see the score appear on that job's card | Layout/design system, URL state design, list performance, card-level cross-feature reads |
| 3 | **Applications core.** `applications` model/selectors/store, Save and Mark as applied, rail with rows, stage label on cards, read-mostly timeline with status/date/notes editing | Save a job from search: the card badge and the rail row appear together and always match; refresh persists | The "never disagree" guarantee; the `phase`/`kind` semantics |
| 4 | **Stage editing + close-out.** Add/remove/rename/reorder with suggestion picker, close-out dialog with reasons, closed history, reopen | Build a custom pipeline for one job; close it as rejected; it leaves the active rail but its timeline remains | Form/dialog ergonomics (TanStack Form + Radix) |
| 5 | **Pipeline strip + nudges.** Counts, response rate, strip-click filtering via `?pipeline=`, nudges for quiet and upcoming | Click "Interviewing" and the rail filters; an old applied job shows a quiet nudge | Date logic with injectable `now` |
| 6 | **Job chat.** `/api/chat` NDJSON, stream reader, optimistic thread, Stop, persisted threads | Ask "what would I do in week one?" and watch the answer stream; Stop works; reply survives refresh | Streaming through Express and Vite proxy (buffering/compression gotchas) |
| 7 | **Hardening.** Cross-tab rehydrate, corrupt-storage recovery toast, quota handling, missing-key and offline states, a11y/keyboard pass on timeline and dialogs, Playwright flows (AI stubbed) | Pull the server's key, corrupt localStorage, open two tabs — app recovers gracefully | Resilience |

UI and styling are carried by every phase (Phase 2 owns the design tokens and shared components in `src/components/`), not deferred to Phase 7. Fit-analysis UI for learning plan/tailoring is minimal in Phase 1 and gets its designed presentation in Phase 2's "My fit" tab.

**If the roadmap wants thinner phases:** split Phase 1 into 1a (scaffold + resume parse, visible profile) and 1b (jobs stub + fit). Do not move the AI path later than Phase 2.

## Scaling Considerations

This is a local single-user app; "scale" means data volume, not users.

| Concern | Now (seed ~100 jobs, tens of applications) | Stretch (real feed, hundreds of applications) |
|---------|--------------------------------------------|-----------------------------------------------|
| Search | In-memory filter + sort in the server process | Replace `services/jobs` with a real source behind the same route; contracts unchanged |
| Rail/list derivation | Plain functions during render | Virtualise the list first; selectors stay pure |
| localStorage | KBs-MBs, well under 5 MB | Move stores to IndexedDB via a different `StateStorage` (persist API unchanged); prune analyses |
| AI cost/latency | On-demand only; fit 10-30 s, chat streams | Prompt caching on the job context, smaller model for chat, split fit into core + plan calls if latency is too high |
| Multi-device | Out of scope | Server persistence is a new milestone; stores' Zod schemas and `version` migrations are the seam |

### Scaling Priorities

1. **First bottleneck: fit latency.** One call generating score, strengths, gaps with learning plans and tailoring may take 20-30 s. Measure in Phase 1. If too slow: split into `/api/fit` (score, strengths, gaps) and a lazy second call for plan + tailoring; the data model above already groups them so the split is non-breaking.
2. **Second: localStorage size** if chat threads or analyses grow; caps and pruning are designed in.

## Anti-Patterns

### Anti-Pattern 1: Copying job fields into the applications store

**What people do:** Save `title`/`company` on the application "so the rail is self-contained".
**Why it's wrong:** Violates the stack rule, creates stale duplicates, and is a second source of truth.
**Do this instead:** Store `jobId`; resolve display data through `jobQueries.detail`. (Flagged decision if a real feed arrives.)

### Anti-Pattern 2: Storing status, counts, or order alongside what they derive from

**What people do:** `application.status = 'interviewing'`, a `counts` object for the strip, or a numeric `order` on each stage.
**Why it's wrong:** The card, rail and strip drift apart the first time one write path forgets to update the copy — the exact bug the project exists to avoid.
**Do this instead:** Phase, counts, current stage, nudges are pure selectors over `stages` and `closeOut`; order is array position.

### Anti-Pattern 3: Selectors that return fresh arrays/objects (Zustand v5)

**What people do:** `useStore((s) => Object.values(s.byJobId).filter(...))`.
**Why it's wrong:** New reference every call triggers React's "getSnapshot should be cached" loop in v5.
**Do this instead:** Select stable slices (`s.byJobId`) and derive in render, or wrap with `useShallow`.

### Anti-Pattern 4: Mirroring URL params into a store (or effects to sync them)

**What people do:** Put filters in Zustand and `useEffect` them to/from the URL.
**Why it's wrong:** Two owners, flicker, and effects-for-derivation are banned by the stack.
**Do this instead:** URL is the single owner; one hook parses it; children get props.

### Anti-Pattern 5: Impure render clocks

**What people do:** `Date.now()` or `new Date()` inside components/selectors for "days quiet".
**Why it's wrong:** The React Compiler assumes pure renders; results go stale or mismatch between card and rail.
**Do this instead:** Selectors take `now` as an argument; components get it from `useNow()` (a `useSyncExternalStore` clock ticking coarsely).

### Anti-Pattern 6: Trusting the client for job content or key-bearing calls

**What people do:** Send the full job description from the browser to the AI endpoint, or call Anthropic from the client "just for the demo".
**Why it's wrong:** Spoofable prompts, bigger payloads, and a leaked key.
**Do this instead:** Client sends `jobId`; server resolves the job from its seed. The key exists only in `server/` env.

### Anti-Pattern 7: Persisting what you can re-derive or that is heavy/sensitive

**What people do:** Store the PDF base64, raw resume text, or contact details in localStorage "for re-parsing".
**Why it's wrong:** Blows quota, widens privacy exposure, contradicts the "not stored" promise.
**Do this instead:** Persist only the parsed, minimised profile; re-upload to re-parse.

### Anti-Pattern 8: Treating resume/job text as trusted prompt input

**What people do:** Interpolate resume or job text straight into instructions.
**Why it's wrong:** A resume (or a pasted job description) can contain instructions; output could be steered.
**Do this instead:** Put untrusted text in clearly delimited data blocks, keep instructions in the system prompt, and constrain output with a schema that the server re-validates.

### Anti-Pattern 9: One giant store or a "God" workspace context

**What people do:** A single Zustand store for everything.
**Why it's wrong:** Violates "one small store per concern", couples persistence/migration lifecycles, re-renders broadly.
**Do this instead:** Four small persisted stores, orchestrated by plain functions in the owning feature.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Messages API | `@anthropic-ai/sdk` in `server/services/ai/client.ts` only. Parse: `document` block (base64 PDF) or text + structured output. Fit: `client.messages.parse({..., output_config:{format: zodOutputFormat(schema)}})` -> `parsed_output`. Chat: `client.messages.stream()` + `.on('text')` | PDF support is in the stable (non-beta) content block types per SDK source. Page/size limits (reported as ~32 MB request / ~100 pages) are from memory — verify in Phase 1. Check Zod major-version compatibility of `zodOutputFormat` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| client <-> server | JSON over same-origin `/api`, NDJSON for chat | Every response Zod-parsed in `apiFetch`; every request validated by `validate()` |
| `workspace` -> panes | Props (`query`, `selectedId`, `pipeline`, callbacks) | Panes do not read the URL |
| UI features -> domain features | Hooks from `index.ts` (`useApplication`, `useFitScore`, `useResume`) | One-way; lint-enforced |
| Domain feature <-> domain feature | `fit-analysis` needs `useResume`; `resume` calls `fit-analysis` store in `replaceResume` | Keep to this one edge; if it grows, move `replaceResume` to a neutral `lib/` orchestrator |
| `shared/` <-> both sides | Imported package `@jobs/contracts` | No logic, only schemas and inferred types |

## Open Decisions to Confirm (stack-conventions says ask rather than work around)

1. **AI results and parsed resume in Zustand.** These are mutation outputs the user owns (PROJECT.md says client-owned and persisted), not refetchable server state, so this design treats them as user data. If the rule is read strictly, the alternative is Query persistence, which adds a package. Recommend: keep as designed.
2. **No router; URL state via a small `useSyncExternalStore` helper.** Needs no new dependency. Confirm no router is wanted.
3. **`shared/` as an npm workspace** (server keeps its own `package.json`). Alternative of relative imports is fragile. Confirm the scaffold's package manager.
4. **Application stores `jobId` only**, with the rail depending on the jobs endpoint. Revisit if a real feed is added.
5. **Scaffold gap:** `tsconfig.json` and `src/features/greeting/GreetingForm.tsx` referenced by `stack-conventions` do not exist yet; create in Phase 1 or amend the skill.

## Sources

- `/Users/yoav/Mnt/gsd-pilot/.planning/PROJECT.md` and `.claude/skills/stack-conventions/SKILL.md` — constraints and requirements (HIGH)
- Anthropic TypeScript SDK docs via Context7 (`/anthropics/anthropic-sdk-typescript`): `DocumentBlockParam` in stable `ContentBlockParam`; `messages.parse` + `zodOutputFormat` -> `parsed_output`; `MessageStream` `text` event (HIGH for API shapes; PDF limits and latency MEDIUM, unverified)
- Zustand v5.0.12 docs via Context7 (`/pmndrs/zustand`): `persist` with `createJSONStorage`, `partialize`, `version`/`migrate`, `skipHydration`, `onRehydrateStorage` (HIGH). The "fresh array selector" loop is documented Zustand v5 behaviour (MEDIUM — confirm against the installed version)
- TanStack Query v5.90 docs via Context7 (`/tanstack/query`): `experimental_streamedQuery` still marked experimental, hence not recommended (HIGH). Mutation-hook vs `mutate()`-level callback behaviour on unmount is from TanStack docs/knowledge (MEDIUM — add a test in Phase 1)

---
*Architecture research for: LinkedIn-style jobs workspace with application tracking and AI fit analysis*
*Researched: 2026-10-10*
