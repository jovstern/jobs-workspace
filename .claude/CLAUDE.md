<!-- GSD:project-start source:PROJECT.md -->

## Project

**Jobs Workspace**

A redesigned, LinkedIn-style jobs page for a single job seeker: one three-pane workspace
where searching for jobs, tracking applications and getting AI fit analysis all happen
without leaving the page. It is "a new smart, personal place to search and monitor the
next role": not only a place to look for a job, but one that helps the user find their best
fit and shows what is missing from their resume or what they need to learn.

**Core Value:** The user can search for jobs and see and update the progress of every application on the
same page, without ever losing their search context.

### Constraints

- **Tech stack**: Fixed by `.claude/skills/stack-conventions` (Vite, React with the compiler,
  TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zod, Zustand, Express in
  `server/`) — decided before kickoff; not open for alternatives
- **Backend**: Stateless Express server — serves seeded jobs and proxies AI calls; holds no user data
- **Persistence**: Browser storage only — user chose no server-side user data for the first version
- **AI**: Claude via the Anthropic API, called only from the server — the API key must never
  reach the browser; supplied by the user in a local `.env`
- **Privacy**: The resume is sent to the server only as part of an AI request and is not stored there
- **Process**: Every phase must end in something visibly working that a short GIF can show;
  the riskiest unknown is proven first
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Decided, Not Researched

| Concern | Decided | Registry version (2026-10-10) |
|---|---|---|
| Build / language | Vite, TypeScript strict | vite 8.3.4, typescript 7.0.2 |
| UI | React + React Compiler | react / react-dom 19.3.0, babel-plugin-react-compiler 1.0.0 |
| Styling | Tailwind utility classes | tailwindcss + @tailwindcss/vite 4.3.3 |
| Primitives | Radix | radix-ui 1.7.0 |
| Server data | TanStack Query | @tanstack/react-query 5.104.1 |
| Forms / validation | TanStack Form + Zod | @tanstack/react-form 1.33.5, zod 4.6.5 |
| Client state | Zustand | zustand 5.0.15 |
| Backend | Express + TypeScript in `server/` | express 5.3.0 (latest-4 is 4.22.3) |
- **TypeScript 7.0.2 is npm `latest`.** I did not research it. Confirm `tsc`, the ESLint TypeScript parser and `tsx` work together in the scaffolding phase. Confidence LOW that nothing breaks.
- **Express is 5.x.** This matters for two open pieces below (`req.query` is read-only, async handler errors propagate automatically).

## Recommended Stack (open pieces only)

### Core Technologies

| Technology | Version | Purpose | Why | Confidence |
|---|---|---|---|---|
| `@anthropic-ai/sdk` | 0.133.0 | Claude calls from Express | Official SDK, already types `claude-sonnet-5-5` and `claude-haiku-5-5`. Ships `messages.parse()` and `zodOutputFormat` (`@anthropic-ai/sdk/helpers/zod`), peer `zod ^3.25 \|\| ^4`, so it works with our Zod 4.6.5. Verified in the installed type definitions. | HIGH |
| `unpdf` | 1.8.1 | PDF to text on the server | Serverless build of PDF.js: no worker, no canvas, no native build. Two-call API (`getDocumentProxy`, `extractText({mergePages:true})`). Actively maintained (Aug 2026). Needs Node >=22 (we run 24.19.0). | HIGH |
| `mammoth` | 1.13.0 | DOCX to text | `extractRawText({buffer})`, pure JS, maintained (Sep 2026). Costs about 5 lines, so "DOCX if cheap" is yes. Legacy `.doc` is not supported; reject it. | HIGH |
| `express.raw()` (built in to Express 5) | n/a | Upload handling | The resume is the only payload, so no multipart parsing and no extra dependency. See "Upload handling" for why not `multer`. | MEDIUM |
| Zustand `persist` + `localStorage` | zustand 5.0.15 | Persist applications, stages, profile, cached analyses | Total data is well under the 5 MiB `localStorage` limit, hydration is synchronous (no loading flash), and `version` + `migrate` are built in. IndexedDB is the documented escape hatch. | HIGH |
| `@dnd-kit/react` + `@dnd-kit/helpers` | 0.5.0 + 0.5.0 | Stage drag-to-reorder | Maintained successor to legacy dnd-kit (published Sep 2026). React 18/19 peer. Keyboard sensor on by default, configurable screen-reader announcements. **Pre-1.0 and React Compiler behaviour is unverified, so it needs a spike and is always paired with Move up/Move down buttons.** | MEDIUM |
| `date-fns` | 4.4.0 | Calendar-day maths for nudges, relative labels | Tree-shakeable pure functions; `differenceInCalendarDays`, `parseISO`, `formatDistanceToNowStrict`, `addDays`. | HIGH |
| `minisearch` | 7.2.0 | In-memory keyword search over the seeded jobs | ~300 docs: field boosting, prefix, fuzzy, zero dependencies. | MEDIUM |
| `eventsource-parser` | 4.1.1 | Parse the SSE stream in the browser | Native `EventSource` is GET-only and cannot carry the resume, so we `fetch` a POST and need a correct chunk-boundary-safe parser. | HIGH (package), MEDIUM (v4 API unexercised) |
| `@faker-js/faker` (dev only) | 10.6.0 | Seeded generator for job postings | Deterministic via `faker.seed(n)`; runs at dev time, never ships. | HIGH |

### Claude models (per task, configured in one module)

| Task | Model ID | Effort | Why |
|---|---|---|---|
| Fit analysis (score, strengths, gaps, learning plan, tailoring tips in ONE call) | `claude-sonnet-5-5` | `medium` | The differentiating feature, so reasoning quality matters. Anthropic labels Sonnet 5.5 "best combination of speed and intelligence": $2 / $10 per MTok. |
| Ask-about-this-job chat (streamed) | `claude-sonnet-5-5` | `low` | Short answers; Anthropic's guidance is `low` for chat. Thinking is on by default at `high`, which would delay first token. |
| Resume text to structured profile | `claude-haiku-5-5` | `medium` (its default) | Extraction is Haiku 5.5's stated use case; $0.10 / $0.50 per MTok, "fastest". Released 2026-10-07 (3 days old), so keep the ID in config and fall back to Sonnet 5.5 if quality disappoints. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `express-rate-limit` | 8.7.1 | Cap AI route calls | Always on `/api/ai/*`. Protects the user's API spend from a runaway client loop (a bad `useEffect` or refetch). |
| `helmet` | 8.3.0 | Security headers | Optional. Worth it only if Express serves the built client; skip for a pure dev-proxy API. |
| `tsx` | 4.23.15 | Run/watch TS server and the seed script | Dev and local start. Type-checking stays with `tsc --noEmit`. |
| `@types/express` | 5.0.6 | Types | Matches Express 5. |
| `@date-fns/tz` | 1.5.0 | Time zones | **Do not install.** Single user, local time zone, date-only strings. |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `server/scripts/generate-jobs.ts` | Produces `server/data/jobs.json` | Fixed `faker.seed`, committed output, run manually. Details below. |
| `server/.env` + `.env.example` | `ANTHROPIC_API_KEY`, optional model overrides | Parse with a Zod env schema at boot and exit with a readable message if missing. `.env` gitignored. |

## 1. Resume extraction and upload handling

- Client sends `fetch(url, { method: "POST", body: file, headers: { "content-type": file.type } })` inside the mutation. No `FormData`.
- Size: body-parser rejects an over-limit `Content-Length` before reading and enforces the limit while streaming. 5 MB is generous for a resume. Map the 413 to a friendly error.
- Type: the MIME type is client-supplied, so also check magic bytes after the body arrives: PDF starts `%PDF-`, DOCX starts `PK\x03\x04`. Anything else is 415.
- Zod at the boundary: validate the `content-type` header and the `Buffer` shape with Zod (stack rule), then the response with the shared schema.
- Memory only. Never write the buffer to disk and never log bodies. This satisfies "resume is not stored on the server".
- PDF guards: read the page count from the document proxy before extracting and reject above ~15 pages; cap extracted text at ~60,000 characters. If `text.trim()` is empty the PDF is scanned (no text layer): return 422 with "paste your resume text instead". (Fallback if scanned PDFs matter later: send the PDF to Claude as a native `document` block, which the API supports up to 32 MB; defer.)

## 2. Claude from Express

### Client and configuration

### Structured JSON validated with Zod

- Not supported by the API: `minimum`/`maximum`, `minLength`/`maxLength`, recursive schemas, array constraints beyond `minItems` 0/1. The SDK strips these and re-validates client-side, but do not rely on them to shape the model's output. Express ranges (a 0-100 fit score) in `.describe()` text and clamp/validate afterwards.
- Use enums for closed sets (gap severity, effort size). Use `z.iso.date()`-style formats only where listed as supported (`date` is).
- One call returns fit score, matched strengths, gaps with a learning plan per gap, and tailoring tips/missing keywords. One round trip is faster and cheaper than four calls and the pieces stay consistent. Chat is the only separate call.
- **Do not use forced `tool_choice`** (400 on Sonnet 5.5). Structured outputs is the replacement; no tools are needed anywhere in this app.
- Always check `stop_reason`: `refusal` (HTTP 200, schema not guaranteed) and `max_tokens` (truncated). Map to typed errors the client shows as a retryable message.
- Unverified edge: the structured-outputs doc page text suggests `output_config` carries `format`, while the SDK types also expose `effort` in the same object. Combining them is expected to work; confirm in the first AI spike (see "Verify at implementation").

### Streaming the chat (Express to browser)

- Use SSE framing over a POST `fetch` (the resume and history make the request too large and too sensitive for a GET URL, which is why native `EventSource` is out). Errors mid-stream are sent as a `{type:"error"}` event, because the status line is already 200.
- Send **text-only** history from the client each turn. The server is stateless, and replaying text avoids the "thinking blocks are bound to the conversation" 400s that apply to replayed thinking blocks on Sonnet 5.5. (MEDIUM: reasoned from the model-migration notes, confirm in the chat spike.)
- Thinking is on by default and its text is omitted by default, so the first visible token can lag. `low` effort keeps that short. Do not set `thinking: {type:"disabled"}`; it is a 400 on Sonnet 5.5.
- Do not mount `compression` on this route.

### Consuming the stream through TanStack Query

- **One query per turn**, keyed by turn id; the question and the earlier turns' answers feed the next request. User messages are session UI state in the chat component; assistant answers are read from the Query cache. Chat is not persisted (not in the requirements).
- **The `staleTime`/`refetch*` options are mandatory.** A default refetch on focus would silently re-run a paid model call.
- The fetch's `AbortSignal` is the query's `signal`, so leaving the job or unmounting cancels the request and `res.on("close")` stops the model stream.
- Parse each SSE `data:` payload with the shared Zod event schema before yielding.
- Read the response body with a `getReader()` loop inside the async generator rather than `for await` over the `ReadableStream`; async iteration of `ReadableStream` has historically been missing in Safari (MEDIUM, not re-verified). Feed chunks to `createParser` from `eventsource-parser`.
- The API is `experimental_`. Wrap it behind `chatTurnOptions` so a breaking change touches one file. Fallback if it misbehaves: `useMutation` whose `mutationFn` calls `queryClient.setQueryData` per chunk. Still inside Query.
- Fit analysis and resume parse are plain `useMutation` (on demand, non-streamed). Not `useQuery`: they cost money and must never refetch implicitly.

### Prompt caching for the resume

- Keep `system` frozen: no date, no ids, no per-user text (any change invalidates everything after it).
- Put the resume as the **first user content block** with `cache_control: {type:"ephemeral"}`, followed by the job description block and the question with no marker. A second analysis of a different job within 5 minutes reads the resume prefix from cache.
- For chat, the prefix (system + resume + job description) is stable across turns; use the top-level automatic `cache_control` so each turn caches the growing history.
- The client sends `resumeText` as the stored canonical string, and the server inserts it **verbatim**. Never re-serialise a profile object on the server (key order or whitespace changes would defeat the cache).
- Minimum cacheable prefix is 512 tokens on Sonnet 5.5 and Haiku 5.5 (Haiku 5.5 confirmed on its page; Sonnet 5.5 value from the bundled skill, which says to check docs). A resume plus instructions clears it.
- Default TTL 5 minutes. Sonnet 5.5 cache reads are 5% of base input.
- Verify by logging `usage.cache_read_input_tokens` in dev. Zero on a repeated call means a silent invalidator.
- **Be honest about value:** at these sizes (about 3K tokens) caching saves a fraction of a cent per call. The real gain is chat latency over several turns. Implement it because it is a few lines, but do not architect around it.
- Caching is ephemeral on Anthropic's side and does not conflict with "the server stores nothing".

### Other AI rules

- Resume and job text are untrusted input. Keep instructions in `system`, wrap user content in delimited tags, and state that content inside them is data. Structured output and a tool-less chat bound the damage.
- Refusals: Sonnet 5.5 supports a beta server-side fallback; Haiku 5.5 has none. Resume/job content should rarely trip classifiers. v1: handle `stop_reason === "refusal"` with a friendly retry message; treat the fallback as optional hardening.

## 3. Browser persistence

| Store | Persisted key | Contents |
|---|---|---|
| applications | `jw.applications` | Applications, each with `jobId`, status, stages (stable `id`, name, status, date, notes), close-out |
| resume | `jw.resume` | Canonical resume text, hash, parsed profile |
| analyses | `jw.analyses` | Fit analyses keyed `${jobId}:${resumeHash}`, with `model` and `createdAt` |
- Size: the limit is 5 MiB for `localStorage` (MDN). Realistic use is a resume of about 10-20 KB, tens of applications at a few KB, and analyses at about 3-6 KB each: well under 1 MB. Notes are free text but human-sized.
- Synchronous hydration means the store is populated on first render, so result cards can show stage and fit score with no loading state and no `skipHydration`/`hasHydrated` handling. That directly serves "search list and rail must never disagree".
- Escape hatch: Zustand's storage is an adapter. Moving to IndexedDB later (idb-keyval 6.3.0, about 15 lines) makes hydration async, which then needs a hydration gate. Trigger to move: measured usage above about 2 MB. Do not use Dexie 4.4.6 (a query layer we do not need).
- `version` + `migrate(persisted, version)` per store. Start at `version: 1` from day one. Add a migration whenever the shape changes.
- **Validate on load with Zod.** In `merge` (or `migrate`), `safeParse` the persisted blob. On failure do not silently reset: copy the raw string to `jw.<store>.corrupt-<timestamp>`, surface a Radix toast, and start empty. Stored data is user input from a previous code version.
- `partialize` to persist data only (actions are not serialised anyway).
- Wrap `setItem` in a custom `StateStorage` that catches `QuotaExceededError` and reports it (toast), because a throwing `setItem` inside `persist` otherwise fails silently from the user's view.
- Cross-tab: `persist` does not sync tabs. Add one module-level `window.addEventListener("storage", e => e.key === name && store.persist.rehydrate())` in the store file. Last write wins; acceptable for one user.
- Zustand 5: a selector that returns a new object or array each call causes an infinite render loop; use `useShallow` or select primitives.
- Applications, stages, notes, resume text and profile are client-owned. They belong in Zustand.
- Job listings are server data. Store only `jobId` in an application. Render the rail and cards from TanStack Query. For many applications, add a batched `GET /api/jobs?ids=a,b,c` so the rail does one query. Seeded jobs never disappear, so a snapshot is not needed. (If the user later wants delisting resilience, a deliberate snapshot is a decision to revisit with them; I recommend against it now because it is a literal reading of the rule.)
- **Cached AI analyses are a judgement call; flag to the user.** They came from a server call, but they are paid, non-deterministic, non-refetchable, and must outlive Query's `gcTime` and be readable synchronously by every result card. I recommend treating them as client-owned records (the requirement says they persist), written from the mutation's `onSuccess`. The alternative, `@tanstack/react-query-persist-client`, is built for re-fetchable data with `maxAge`/`buster` and would fight the requirement. Confidence MEDIUM; this is an interpretation of the rule and should be confirmed.
- Invalidate an analysis when the resume hash changes (SHA-256 via `crypto.subtle`, no library).

## 4. Seeded jobs: generation, search, pagination

- `server/scripts/generate-jobs.ts` using `@faker-js/faker` 10.6.0 with `faker.seed(...)`, writing `server/data/jobs.json` (about 300 postings, roughly 0.5-1 MB). Run manually; commit the output so reviews see real data and the demo is reproducible. Not generated per build or per request.
- Realism comes from **curated archetype tables**, not from faker text. `faker.lorem` reads as filler and would make the fit analysis demo meaningless. Define about 15-20 role archetypes (frontend, backend, data, PM, design, DevOps, QA, and so on), each with a skills pool, responsibilities pool, requirements pool, and seniority modifiers. Compose each description from those, with believable salary bands, locations, workplace type (on-site/hybrid/remote), employment type, and experience level. Faker supplies the variation only.
- Companies are **fictional**, with generated initials/colour avatars. No real company names (misleading) and no logo assets (PROJECT.md excludes trademarked assets).
- Store `postedOffsetHours`, not an absolute `postedAt`. The server materialises `postedAt = now - offset` at boot, so "Posted 3 days ago" never goes stale. Absolute ISO dates in a committed file rot.
- Parse the file with the shared Job Zod schema once at startup and fail fast.
- Optional later upgrade (LOW priority, MEDIUM confidence): one-off Claude Batch run to author more natural descriptions per archetype, committed as data. Not needed for v1.
- Build the index once at boot, fields `title` (boost 3), `company` (boost 2), `skills`, `description`, `prefix: true`, light `fuzzy`.
- Filters (location, workplace type, experience level, employment type, date posted, salary) are array predicates applied to the text-search result, or to the whole list when the query is empty. Compute facet counts from the filtered set only if the UI shows them.
- Sort: relevance when a query exists, otherwise newest first, with `id` as the tie-breaker so paging is stable.
- Alternative `fuse.js` 7.5.0 is fine at this size; MiniSearch gives better ranking control and prefix matching for search-as-you-type.

## 5. Drag-to-reorder for stages

- `useSortable` from `@dnd-kit/react/sortable` returns one `sortable` object (`sortable.ref`, `sortable.isDragging`); `DragDropProvider` replaces the old `DndContext`; `move(items, event)` from `@dnd-kit/helpers` does the reorder in `onDragEnd`. Default sensors include `KeyboardSensor`; if you ever pass a `sensors` array, include it explicitly or keyboard access is lost.
- Accessibility is built in (keyboard sensor plus screen-reader announcements via the Accessibility plugin), but **the default announcements print the item `id`**, which is a UUID. Configure `Accessibility.configure({ announcements })` to speak stage names ("Moved Technical interview to position 3 of 6"). Easy to miss, and it ruins the screen-reader experience.
- **Move up / Move down buttons are required, not optional.** WCAG 2.2 SC 2.5.7 (Dragging Movements) needs a single-pointer alternative, and buttons are the most robust one. They also cover any React Compiler incompatibility. The reorder itself is a pure array-move action in the applications store, shared by both paths.
- Use a stable `id` per stage (`crypto.randomUUID()`) as the sortable key, never the array index. Stages are renamed, added and removed without limit.
- **Compiler status: unverified.** I found no documentation or issue for `@dnd-kit/react` and the React Compiler; the migration docs do not mention it. The Compiler skips components it cannot prove safe rather than miscompiling, so the likeliest failure is a stale render of `isDragging`. Spike it early. If it misbehaves, mark the row component with `"use no memo"` (with the reason in a comment, per the lint rule), or fall back to the button-only path.
- Pin `0.5.0` exactly. It is 0.x, so minor bumps can break; 0.5.1 betas exist but `latest` is 0.5.0.

## 6. Dates, system font stack, LinkedIn palette

### Dates

- Store stage dates as **date-only strings** (`YYYY-MM-DD`, schema `z.iso.date()`, verified in Zod 4) and activity timestamps as ISO datetimes. Never store a stage date as a `Date`/timestamp.
- Parse with date-fns `parseISO`, which treats a date-only string as **local** midnight. `new Date("2026-10-10")` parses as UTC and shows the previous day west of UTC. This is the most likely date bug in the app.
- Nudge logic ("gone quiet", "stage in the next few days") is `differenceInCalendarDays(parseISO(date), today)`. Write it as pure functions that take `today` as an argument, so they test without fake timers.
- **React Compiler / purity:** do not call `new Date()` or `Date.now()` during render. Supply "today" from a small `useToday()` hook built on `useSyncExternalStore` (subscribes to a midnight timer and tab visibility). That is the legitimate "sync with something outside React" use and keeps components pure.
- `Intl.RelativeTimeFormat`/`Intl.DateTimeFormat` are fine for display but cannot do calendar-day arithmetic. date-fns is small and tree-shaken. Skip `@date-fns/tz`, `moment`, `luxon`, `dayjs`.

### System font stack (no webfont)

- Tailwind 4.3.3 is CSS-first: tokens live under `@theme`, and `--color-*` variables generate `bg-*`, `text-*`, `border-*` utilities. There is no `tailwind.config.js`. This single `index.css` is the one global file the build needs and does not break the "no ad-hoc per-component CSS" rule.
- Do **not** add `@fontsource/inter` (5.3.0) or Google Fonts. It contradicts "keep their fonts", adds network and flash, and looks unlike LinkedIn.
- Use the built-in `tabular-nums` utility for scores, counts and dates in the pipeline strip.
- LinkedIn's own list has extra legacy Linux fallbacks (Fira Sans, Ubuntu, Oxygen, Cantarell, Droid Sans, Lucida Grande). They are omitted here because rendering on macOS, Windows, Android and modern Linux is identical. Confidence MEDIUM that this matches LinkedIn's list exactly (recalled, not fetched), HIGH that it renders the same.

### Palette tokens (verify visually in the UI phase)

| Token | Value | Basis |
|---|---|---|
| `--color-brand-600` (LinkedIn Blue) | `#0A66C2` | Corroborated by brand-colour sources (2019 refresh) |
| `--color-brand-700` (hover/active) | `#004182` | Corroborated (LinkedIn design-token listing) |
| `--color-canvas` (page background) | `#F4F2EE` | Recalled from the live site, not corroborated |
| `--color-surface` (cards) | `#FFFFFF` | Standard |
| `--color-ink` / `--color-ink-muted` | `rgba(0,0,0,.9)` / `rgba(0,0,0,.6)` | Recalled |
| `--color-success` | `#057642` | Recalled |
| `--color-danger` | `#CC1016` | Recalled |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| PDF text | `unpdf` 1.8.1 | `pdf-parse` 2.4.5 | Works; older release, bigger surface. Fine substitute. |
| PDF text | `unpdf` | Send PDF to Claude natively | Costs tokens on every parse, no editable text step, no paste-path parity. Keep as the scanned-PDF fallback. |
| Upload | `express.raw` | `multer` 2.4.0 | Multipart parsing for one blob is surplus. Use if the form gains fields. |
| Model (parse) | Haiku 5.5 | Sonnet 5.5 | 20x the price for an extraction task. Switch if Haiku 5.5 quality disappoints. |
| Model (fit, chat) | Sonnet 5.5 | Opus 5.5 | 2x price, no evidence of need. One-line change if analysis quality is judged weak. |
| Model (chat) | Sonnet 5.5, `low` | Haiku 5.5 | Likely good and cheaper; 3 days old with no evidence yet. Evaluate once there is a small eval set. |
| Stream transport | SSE over POST + `fetch` | WebSocket / socket.io | Unidirectional, request/response shaped; WebSockets add infrastructure. |
| Stream transport | SSE over POST | Native `EventSource` | GET-only; cannot carry the resume. |
| Persistence | `localStorage` | IndexedDB (`idb-keyval` 6.3.0) | Async hydration complexity not justified under 5 MiB. Documented upgrade path. |
| Persistence of analyses | Zustand (client-owned) | Query persister | See section 3; built for refetchable data. |
| Drag and drop | `@dnd-kit/react` 0.5.0 | `@hello-pangea/dnd` 18.0.1 | Spike fallback; older. |
| Drag and drop | `@dnd-kit/react` | `@atlaskit/pragmatic-drag-and-drop` 4.0.0 | No built-in keyboard or screen-reader support; you build the accessibility yourself. |
| Search | `minisearch` 7.2.0 | `fuse.js` 7.5.0 | Equivalent at this size; MiniSearch ranks and prefix-matches better. |
| Dates | `date-fns` 4.4.0 | `Intl` only | No calendar-day arithmetic. |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| Vercel AI SDK `useChat`, LangChain | Own client-side fetch and message state; duplicates Query and bypasses the "every fetch goes through TanStack Query" rule | Official SDK on the server, `experimental_streamedQuery` on the client |
| `tool_choice` `any`/`tool`, `thinking: {type:"disabled"}` on Sonnet 5.5 | Both return 400 on this model | Structured outputs; adaptive thinking with `effort: "low"` |
| `budget_tokens`, `temperature`/`top_p`/`top_k` | Removed on current models (400) | `output_config.effort` |
| Assistant prefill | Removed (400) | Structured outputs / system prompt |
| Date-suffixed model IDs | IDs are complete as written | `claude-sonnet-5-5`, `claude-haiku-5-5` |
| `@dnd-kit/core` + `@dnd-kit/sortable` (6.3.1 / 10.0.0) | Legacy line, last published Dec 2024 | `@dnd-kit/react` |
| `react-beautiful-dnd`, `react-dnd` | Archived/stale for React 19; react-dnd's HTML5 backend lacks keyboard drag | See section 5 |
| `redux-persist`, `zustand-persist` (third party), `localforage` | Duplicate or unmaintained; Zustand ships `persist` | Built-in `persist` |
| `dotenv` 18.0.7 | Node 24 has `process.loadEnvFile()` | Built-in |
| `compression` on SSE routes | Buffers the stream | Leave off AI routes |
| `zod-to-json-schema` | SDK helper and Zod 4 handle schema conversion | `zodOutputFormat` |
| `@fontsource/inter`, Google Fonts | Wrong look, extra loading | System stack |
| `moment`, `luxon`, `dayjs`, `@date-fns/tz` | Duplicate or unneeded | `date-fns` |
| Request-body logging (e.g. `morgan` with bodies) | Would put resumes in logs; breaks "not stored" | Log method, path, status, duration only |
| A router library | Not in the fixed stack and nothing requires it | Keep search state in the page |

## Stack Patterns by Variant

- Return 422 and prompt "paste your text instead"; consider the native Claude `document` block later.
- Because OCR is a different cost/privacy decision, not a v1 default.
- Swap the persist storage adapter to IndexedDB (`idb-keyval`) and add a hydration gate.
- Because `localStorage` is synchronous and capped at 5 MiB.
- Mark the row `"use no memo"` with a reason, else ship the buttons-only reorder.
- Because buttons are already required for accessibility.
- Change `MODELS.parse` to `claude-sonnet-5-5` (config only).
- Because model IDs are isolated in one module.

## Version Compatibility

| Package | Compatible With | Notes |
|---|---|---|
| `@anthropic-ai/sdk` 0.133.0 | zod 4.6.5 | Peer `zod ^3.25 \|\| ^4.0.0`; `zodOutputFormat` exported from `@anthropic-ai/sdk/helpers/zod` (verified in package) |
| `unpdf` 1.8.1 | Node >=22 | Local Node is 24.19.0. Optional peer `@napi-rs/canvas` is only for rendering; do not install |
| `@dnd-kit/react` 0.5.0 | react / react-dom ^18 \|\| ^19 | Depends on `@dnd-kit/dom`, `state`, `abstract` 0.5.x; install `@dnd-kit/helpers` 0.5.0 separately |
| `@tanstack/react-query` 5.104.1 | `@tanstack/query-core` 5.104.1 | `experimental_streamedQuery` exported (still experimental-prefixed at this version) |
| `express` 5.3.0 | `@types/express` 5.0.6 | `req.query` read-only; async errors auto-forwarded |
| `eventsource-parser` 4.1.1 | browser | `engines: node >=22.12` is irrelevant for browser use; exports `.` and `./stream` |
| `claude-sonnet-5-5` | structured outputs, adaptive thinking, caching | 1M context, 128K output; no forced tool use, no `disabled` thinking |
| `claude-haiku-5-5` | structured outputs, adaptive thinking, caching (512-token minimum) | No server-side refusal fallback; `thinking: disabled` allowed at `low`/`medium`/`high` |

## Installation

# Client (root package)

# Server (server/package.json)

# optional: npm install helmet

## Verify at Implementation (spikes the roadmap should schedule)

## Sources

- npm registry (`npm view`), 2026-10-10 — all package versions, peer dependencies, engines and publish dates — HIGH
- Installed `@anthropic-ai/sdk@0.133.0` package contents (`helpers/zod.d.ts`, `resources/messages/messages.d.ts`, `CHANGELOG.md`) — `zodOutputFormat`, `messages.parse`, `output_config.effort`, `claude-haiku-5-5`/`claude-sonnet-5-5` model types — HIGH
- Installed `@tanstack/query-core@5.104.1` build — `streamedQuery` exported as `experimental_streamedQuery` — HIGH
- https://platform.claude.com/docs/en/models/overview — model IDs, prices, latency ranking, retirement dates — HIGH
- https://platform.claude.com/docs/en/models/haiku-5-5/overview — Haiku 5.5 price tiers, release date 2026-10-07, 512-token cache minimum — HIGH
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 — effort guidance, no server-side fallback, refusal categories — HIGH
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs — supported models, JSON Schema limits, refusal/`max_tokens` behaviour — HIGH (the page's statement about `output_config` containing only `format` conflicts with the SDK types; trust the types, spike per item 1)
- Claude API skill reference (bundled, cached 2026-09-25): Sonnet 5.5 migration notes (forced tool use and disabled-thinking 400s, preserved thinking), prompt-caching placement and invalidators — MEDIUM (cached copy; predates Haiku 5.5)
- Context7 `/pmndrs/zustand` — persist `version`, `migrate`, `partialize`, `createJSONStorage`, `skipHydration` — HIGH
- Context7 `/tanstack/query` — `streamedQuery` semantics (`reducer`, `initialValue`, `refetchMode`) — HIGH
- Context7 `/unjs/unpdf` — `getDocumentProxy`, `extractText({mergePages})`, `loadingTask.destroy()` — HIGH
- Context7 `/clauderic/dnd-kit` and https://dndkit.com/react/guides/migration — `useSortable`, `move`, sensors, Accessibility plugin — MEDIUM (no Compiler guidance found)
- Context7 `/colinhacks/zod` — `z.iso.date()` — HIGH
- Context7 `/websites/tailwindcss` — `@theme`, `--font-sans`, `--color-*` — HIGH
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria — 5 MiB localStorage, `QuotaExceededError`, `navigator.storage.persist()`, Safari 7-day rule — HIGH
- https://webkit.org/ (ITP 7-day script-writable storage cap, via search results) — HIGH
- Brand-colour listings (brandpalettes.com, brandcolorcode.com, shadcn.io LinkedIn design page) — `#0A66C2`, `#004182` — MEDIUM
- Contrast ratios computed locally (WCAG 2.x relative-luminance formula) — HIGH

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| kickoff | Start a new project - interview, roadmap, CLAUDE.md, starter code with quality gates, and a protected GitHub repo. | `.claude/skills/kickoff/SKILL.md` |
| milestone | Run one milestone end to end - questions, plan, build, test, review, demo, pull request. | `.claude/skills/milestone/SKILL.md` |
| pr-demo | Record a demo GIF of the current phase's main user flow and publish it for the pull request. Use after a phase is verified and before it is shipped, or when a PR is missing its demo. | `.claude/skills/pr-demo/SKILL.md` |
| quality-gates | The definition of done for this project. Read before planning tasks, before saying any work is complete, and when verifying a phase. | `.claude/skills/quality-gates/SKILL.md` |
| stack-conventions | Required stack and coding rules for this project (Vite, React with the compiler, TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zustand, Express). Read before planning, writing or reviewing any code. | `.claude/skills/stack-conventions/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
