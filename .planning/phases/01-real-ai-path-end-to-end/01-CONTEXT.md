# Phase 1: Real AI path, end to end - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The user gives the app a resume (PDF upload or pasted text), reviews and corrects what was
extracted, and runs "Check my fit" on one of a small set of hand-written seed jobs. A real AI
model (Google Gemini, called only from the Express server) rates each job requirement against
quoted evidence from the resume; code computes the score. The user sees gaps, a learning plan
per gap and tailoring tips. Resume, profile and analyses persist in the browser across refresh.

Styling is plain in this phase. The three-pane workspace, search, the LinkedIn-like shell and
the design system are Phase 2. Tracking, stages, nudges, chat and export/import are later
phases. A stub page with a job picker is enough to host the resume flow and the fit panel.

Requirements of the original, unsplit phase: RES-01..06, FIT-01..08, FIT-10, FIT-11, DATA-01, DATA-02, DATA-06, DATA-07. See "Scope After the Split" below for what Phase 1 itself now covers.

</domain>

<scope_after_split>
## Scope After the Split (2026-10-10, user decision)

Planning showed the original Phase 1 (20 requirements) was too large to plan at full quality.
The user chose to split it into three phases. **This file, `01-RESEARCH.md`, `01-UI-SPEC.md`,
`01-PATTERNS.md` and `01-VALIDATION.md` describe the union of all three**; the roadmap is the
authority on which part belongs to which phase.

| Phase | Delivers | Requirements | Decisions that land here |
|-------|----------|--------------|--------------------------|
| **1** (this phase) | Rated fit check on pasted text | RES-02, FIT-01, FIT-02, FIT-03, FIT-08, DATA-01, DATA-06, DATA-07 | D-01 to D-04, D-07, D-10, D-11, D-14, D-15, D-16, D-18, D-19 |
| **01.1** | Gaps, learning plan, tips, failure handling, storage safety | FIT-04, FIT-06, FIT-07, FIT-11, DATA-02 | D-02 (rate-limit and quota messages), wording rules |
| **01.2** | PDF upload, two-step review, resume lifecycle | RES-01, RES-03, RES-04, RES-05, RES-06, FIT-05, FIT-10 | D-05, D-06, D-08, D-09, D-09a, D-12, D-13, D-17 |

**What Phase 1 is and is not:**
- In: paste a resume (contact details and links removed, user told), pick one of 8-10 seed jobs,
  "Check my fit" through the real SDK path, per-requirement ratings with verified quotes, score
  and band computed in code, results and resume persisted in the browser, the privacy note, the
  server guards (key custody, origin check, rate limiter, metadata-only logging), a typed error
  envelope with one generic retryable message and the "AI not configured" notice.
- Not in Phase 1: PDF upload and the unreadable-PDF fallback, the structured profile and its
  review step, "I do have this", replace/delete and the stale marker (all 01.2); gaps list,
  learning plan, tailoring tips, the full per-error message table and progress stages, and the
  migration / corrupt-data set-aside behaviour (all 01.1).
- Shapes Phase 1 must reserve so later phases need no storage migration: the stored resume record
  carries `profile: null` and the stored analysis carries `advice: null` from version 1.
- The first model call in Phase 1 returns ratings only; the advice half (learning plan, tips)
  arrives in 01.1.

</scope_after_split>

<decisions>
## Implementation Decisions

### AI provider
- **D-01:** The AI provider is **Google Gemini**, not Claude. The user supplied a Gemini key at
  the start of this phase. The key is `GEMINI_API_KEY` in `server/.env` (git-ignored). Agents
  must never read, print or log that file's contents. — **Reversibility:** costly — every AI
  service module, the model config and the provider-specific output handling would be rewritten
- **D-02:** The key is on Google's **paid tier**. Plan for paid-tier rate limits. Still handle
  rate-limit and quota errors with a clear, retryable message (FIT-11).
- **D-03:** The Claude-specific project research is **superseded**: everything in
  `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` and `SUMMARY.md` about the
  Anthropic SDK, Claude model ids, Claude API parameter limits, the Claude `document` block and
  prompt caching no longer applies. Phase research must redo these for Gemini: the current
  official SDK, schema-constrained JSON output and how it works with Zod 4, PDF input, model
  choice per task (a fast model for resume parsing, a stronger one for fit analysis), timeouts,
  retries, safety-block and truncation signals, and streaming (needed in Phase 6, worth knowing
  now). The provider-independent findings (score computed in code, quote verification,
  untrusted-input handling, versioned persistence, privacy logging rules) still apply.
- **D-04:** Model ids live in one server config module.

### Resume review step
- **D-05:** Review is **two steps**. Step 1 shows the extracted resume text for correction.
  Step 2 shows the structured profile the AI built from that text, also editable. The edited
  text is the canonical resume string: evidence quotes are verified against it and the cache
  key is derived from it.
- **D-06:** The profile is **lean**: headline, total years of experience, skills (shown as
  chips), and roles (title, company, dates, one-line summary). No education, certifications or
  languages in v1. — **Reversibility:** costly — the profile shape is persisted in the browser
  and embedded in the AI contract; changing it needs a storage migration and a prompt change
- **D-07:** **Contact details are removed before anything is sent to Gemini.** Email, phone and
  street address are stripped from the text sent to the AI, and the profile stores no contact
  details.
- **D-08:** When the user later edits the resume text, saving **asks** "Update your profile from
  the new text?" Yes makes one AI call and rebuilds the profile. No keeps the manual profile
  edits.

### Unreadable PDFs
- **D-09:** The server first tries plain text extraction. If that yields little or garbled text
  (scanned or image-based PDF), the **PDF itself is sent to Gemini**, and its transcription
  goes into the same step-1 review. The user is told this happened. Protected or oversized
  files still get a clear message with the paste-instead option (RES-06).
- **D-09a (Claude's reconciliation of D-07 and D-09, to be confirmed by the user at plan
  approval):** D-07 promises contact details are removed before anything goes to Gemini, but a
  PDF sent to Gemini under D-09 necessarily contains them. To honour both, the fallback is
  **consent-first**: when local extraction fails, nothing is sent yet. The user is told the file
  could not be read and is offered two choices: let Google's AI read the whole file (stated
  plainly: it will see everything in it, including contact details), or paste the text instead.
  The PDF is sent only after the user chooses the first. The transcription that comes back is
  stripped of contact details like any other resume text before it is stored or reused.

### Fit score
- **D-10:** **Required requirements dominate** the score: met is full credit, partial is half.
  Nice-to-haves add only a small bonus and can never rescue a job whose required items are
  missing. The exact formula is Claude's discretion, within that rule.
- **D-11:** The score is labelled with **encouraging bands**: Strong fit / Good fit / Stretch /
  Long shot, shown with the percentage and the word "estimate". It is guidance, never a verdict
  on whether to apply.
- **D-12:** **"I do have this"** adds the skill to the profile as "confirmed by you", so future
  fit checks on other jobs take it into account. The current result updates at once with no AI
  call.
- **D-13:** A self-confirmed skill gets **full credit, clearly marked**: it counts as met and is
  labelled "confirmed by you, not in your resume", with a tip to add it to the resume. The user
  can see which part of the score rests on their own word.

### Seed jobs for this phase
- **D-14:** 8-10 hand-written **software roles at mixed levels**: frontend, backend, full-stack,
  data and engineering manager, from junior to staff. The set must include a deliberate poor
  fit and a near-perfect fit for the synthetic demo resume, so the demo shows the full range of
  results.
- **D-15:** Each job has **6-10 requirements, authored by hand in the seed and shown in the
  posting**: roughly 5-7 required and 2-4 nice-to-have. The model rates this fixed list; it
  never invents the requirement list. Seed job ids are hand-assigned and must never change.
  — **Reversibility:** costly — cached analyses and (from Phase 3) tracked applications are
  keyed by job id and by requirement

### Decided after research (user, 2026-10-10)
- **D-16:** Shared client/server schemas live in an **npm workspace package**
  `@jobs-workspace/shared` (root `workspaces: ["server", "shared"]`). The user approved the
  configuration changes this needs: `server/package-lock.json` is removed in favour of the single
  root lockfile, the CI cache path and the second `npm ci` are adjusted, `shared` is added to the
  root TypeScript `include` and the Vitest `include`, and the `server/` line in the root
  `CLAUDE.md` is updated. See `01-RESEARCH.md` Part E for the exact file table.
  — **Reversibility:** costly — every import of the shared package and the install layout
- **D-17:** PDF text extraction stays **on the server** (in memory, nothing stored or logged).
  DATA-06 was reworded to say so: the resume is sent to the server only to read it and to run AI
  requests. The privacy note in the UI must say the same thing in plain words.
- **D-18:** Contact removal (D-07) also removes **profile and personal links** (LinkedIn, GitHub,
  personal sites, any URL). The person's name stays.
- **D-19:** AI routes get a **small hand-written rate limiter** on the server (no new
  dependency). Do not add `express-rate-limit`.

### Carried forward (already decided, do not re-ask)
- Each requirement is rated met / partial / not evidenced, with a supporting resume quote for
  met and partial; quotes are verified against the resume text.
- Gaps are split required vs nice-to-have and worded "not evidenced in your resume".
- Learning plans name what to learn, why it matters for this job and rough effort. No links and
  no named courses.
- Tailoring tips never suggest claiming something the resume does not support.
- Parsed resume and fit analyses live in persisted Zustand stores, written from the mutation's
  success handler (user sign-off on the stack rule).
- A resume change marks earlier analyses "resume changed, re-check?"; they are not deleted.
- The server is stateless: no storing or logging of resumes, request bodies or model output.
- Synthetic resumes only in tests, fixtures, e2e runs and the demo GIF.

### Claude's Discretion
- The exact score formula, band thresholds and bonus size (within D-10 and D-11).
- How "little or garbled text" is detected for the PDF fallback (D-09).
- Upload size and page limits, settled by measurement.
- Whether fit analysis is one model call or split, decided by measured latency (target under
  about 15 seconds).
- The plain layout of the stub page, the review dialog and the fit panel.
- How the two review steps are presented (dialog steps, tabs or a page).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and decisions
- `.planning/PROJECT.md` — constraints and Key Decisions, including the user's sign-offs on the
  stack rules and the switch to Gemini
- `.planning/REQUIREMENTS.md` — the 20 requirements mapped to this phase
- `.planning/ROADMAP.md` §Phase 1 — goal, demo and success criteria
- `.planning/STATE.md` §Blockers/Concerns — open Phase 1 items

### Rules
- `.claude/skills/stack-conventions/SKILL.md` — fixed stack and coding rules
- `.claude/skills/quality-gates/SKILL.md` — definition of done
- `CLAUDE.md` — project-specific hard rules (root file)

### Research (read with D-03 in mind)
- `.planning/research/SUMMARY.md` — phase shape, conflicts to resolve, critical pitfalls.
  Claude-specific parts are superseded by D-01 and D-03
- `.planning/research/PITFALLS.md` — fit-score, hallucination, prompt-injection, persistence
  and privacy pitfalls (provider-independent parts apply)
- `.planning/research/ARCHITECTURE.md` — state ownership, data model, server layout
- `.planning/research/FEATURES.md` — expected behaviour of resume intake and fit analysis
- `.planning/research/STACK.md` — non-AI open pieces (PDF text extraction, persistence, dates);
  its Claude SDK and model sections are superseded

### Stale file to be aware of
- `.claude/CLAUDE.md` — generated by GSD from the original research. Its Technology Stack
  section still describes the Anthropic SDK and Claude models. Treat that section as
  superseded by D-01 and D-03.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/greeting/GreetingForm.tsx` — the reference form pattern (TanStack Form + Zod,
  label tied to input, `role="alert"`, `aria-invalid`, `aria-describedby`). Follow it for the
  resume paste form and the profile editor. The greeting feature itself is template filler and
  can be removed once a real feature replaces it.
- `src/lib/query-client.ts` — the shared `QueryClient` (30 s stale time, 1 retry). AI
  mutations must not retry or refetch implicitly; they cost money.
- `server/src/app.ts` — `createApp()` with `/api/health`, tested over a real listening port in
  `server/src/app.test.ts`. New routes and their tests follow this shape.
- `e2e/smoke.spec.ts` and `playwright.config.ts` — browser tests are recorded; the demo GIF
  comes from these recordings.

### Established Patterns
- One component per file, named export, feature folders under `src/features/<feature>/`,
  tests next to the file they test.
- `server/` is a separate package with its own `package.json`, lockfile, ESLint config and
  `npm run check`. Root ESLint ignores it; root Prettier covers it. CI runs both.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` on both sides.
- No semicolons, single quotes, 100-column width (Prettier).

### Integration Points
- There is no dev proxy from Vite to the server yet, no shared schema module, no Zustand
  dependency and no env loading on the server. This phase adds all four.
- The server binds to `127.0.0.1:3001` (`server/src/index.ts`).
- `src/App.tsx` currently renders only the greeting form; the stub page for this phase
  replaces it.

</code_context>

<specifics>
## Specific Ideas

- Band names, exactly: **Strong fit / Good fit / Stretch / Long shot**.
- Marker text for a self-confirmed skill: **"confirmed by you, not in your resume"**.
- Gap wording: **"not evidenced in your resume"**.
- Stale marker: **"resume changed, re-check?"**.
- Profile rebuild prompt: **"Update your profile from the new text?"**.
- The privacy note must say plainly that Google processes the resume to produce the analysis.
  Because the key is on the paid tier, it can also say the content is not used to improve
  Google's products; research must confirm the current terms before that sentence ships.

</specifics>

<deferred>
## Deferred Ideas

- Education, certifications and spoken languages in the profile — a later phase or v2, if
  jobs that require them matter to the user.
- Jobs outside software (product, design, marketing, sales, finance) — Phase 2's full seeded
  dataset can broaden the mix.
- A provider-agnostic AI interface with a second provider — offered and not chosen; revisit
  only if the user wants to switch again.

</deferred>

---

*Phase: 1-Real AI path, end to end*
*Context gathered: 2026-10-10*
