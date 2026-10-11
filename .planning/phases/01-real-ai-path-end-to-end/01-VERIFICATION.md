---
phase: 01-real-ai-path-end-to-end
verified: 2026-10-11T16:05:00Z
status: passed
score: 75/79 must-haves verified (5/5 roadmap success criteria; 70/74 plan truths; 4 backstop truths awaiting a human)
covered_files:
  - .planning/phases/01-real-ai-path-end-to-end/01-01-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-01-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-02-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-02-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-03-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-03-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-04-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-04-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-05-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-05-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-06-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-06-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-07-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-07-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-08-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-08-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-09-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-09-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-10-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-10-SUMMARY.md
  - .planning/phases/01-real-ai-path-end-to-end/01-11-PLAN.md
  - .planning/phases/01-real-ai-path-end-to-end/01-11-SUMMARY.md
  - e2e/check-fit.spec.ts
  - e2e/no-secrets.spec.ts
  - server/src/ai/client.ts
  - server/src/ai/prepare.ts
  - server/src/ai/prompts/fit.ts
  - server/src/config/models.ts
  - server/src/fit/analyze.ts
  - server/src/fit/quotes.ts
  - server/src/fit/routes.ts
  - server/src/http/errors.ts
  - server/src/http/local-origin.ts
  - server/src/http/rate-limit.ts
  - server/src/http/request-log.ts
  - shared/src/fit.ts
  - shared/src/fit/score.ts
  - shared/src/resume.ts
  - shared/src/text/redact.ts
  - src/App.tsx
  - src/features/fit-analysis/FitPanel.tsx
  - src/features/fit-analysis/fit-store.ts
  - src/features/fit-analysis/mutations.ts
  - src/features/fit-analysis/selectors.ts
  - src/features/resume/PasteForm.tsx
  - src/features/resume/PrivacyNote.tsx
  - src/features/resume/ResumeCard.tsx
  - src/features/resume/resume-store.ts
covered_digest: "v3:sha256:edf5eb74ccbbb62f5645e6f3ca73fe36d9a6e768d09b0ef878dd7a3a69203b43"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A non-retryable failure (forbidden_origin, validation_error, unsupported_media_type, payload_too_large) must not offer a retry button, and forbidden_origin gets its own line (code review WR-06)"
    addressed_in: "Phase 01.1"
    evidence: "Phase 01.1 success criterion 4: 'a distinct, retryable message for a failure, a timeout, a rate limit and an unconfigured AI service' (FIT-11); recorded in deferred-items.md"
human_verification:
  - test: "Real-model main flow (plan 01-11 Task 3). The user runs `REAL_AI=1 npx playwright test e2e/check-fit.spec.ts -g \"main flow\"` once, or tells an agent to run it at that moment. Uses only e2e/fixtures/resumes/frontend-senior.txt. Then watch the recording in test-results/."
    expected: "The demo resume is pasted and shown with four placeholders, the fit check against Google's model shows a rating and a quote for the requirements, a score with a band labelled as an estimate, and after the reload the same result with no second fit request. Cost a few US cents."
    why_human: "Calls the real paid model with the user's key; only the user may run or authorise it, and only a person can judge whether real ratings and quotes look right. Not run by this verification."
  - test: "Two-tab concurrency (plan 01-08 backstop). Open the page in two tabs, save a resume in one, reload the other; then run a fit check in one and reload the other."
    expected: "The other tab shows the saved resume and analyses with no error and nothing unreadable; the last write wins."
    why_human: "Backstop truth: no cross-tab sync is built and no test exercises two tabs. Presence of complete-record writes is not evidence of behaviour."
  - test: "Result panel at 768px wide (plan 01-10 backstop). Show a result whose quote is 25 words and whose rationale is 300 characters."
    expected: "Everything wraps inside the panel, no horizontal scroll, the quote's left rule intact."
    why_human: "Visual layout; the executor measured it in a throwaway script that was deleted, so no committed test backs it."
  - test: "Privacy note at 768px wide (plan 01-11 backstop)."
    expected: "The four paragraphs wrap inside the resume card without clipping."
    why_human: "Visual layout; measured once (scrollWidth equals clientWidth) but not by a committed test. The executor suggested a human glance."
  - test: "Long job title wrapping (plan 01-05 backstop). Use a 100-character job title at 1024px and 768px."
    expected: "The title wraps inside its row with no horizontal scroll."
    why_human: "Visual layout backstop; no seed job has a 100-character title, so no committed test or fixture covers it."
  - test: "Judgment-tier prohibitions, to be resolved by the user (non-authoritative verifier reading given). (a) 01-09: no paid call without an explicit go-ahead immediately before it. (b) 01-10: score and band are never presented as a verdict, low bands neutral, never red. (c) 01-11: the privacy note makes no claim beyond what was confirmed. (d) 01-11: the real model is never run without a go-ahead. (e) 01-05: no real person, real company or LinkedIn asset in seeds, fixtures or demos."
    expected: "(a) 01-SPIKE-RESULTS.md records run 1 on the user's first go-ahead and run 3 on the user's direct instruction; the user should confirm this matches what they authorised. (b) ScoreBlock uses success, teal, caution and neutral tones and a standing disclaimer; no red. (c) PrivacyNote keeps all four caveats and the paid-tier paragraph rests on the recorded billing decision. (d) No REAL_AI run is recorded and none was run here. (e) Nine fictional companies, example.com and 555 01xx contact details."
    why_human: "Judgment-tier prohibitions are soft-gated: this is a flagged, unverified-prohibition item, never a silent pass."
---

# Phase 1: Real AI path, end to end - Verification Report

**Phase Goal:** As a job seeker, I want to paste my resume and check my fit for a job, so that I see each job requirement rated against quoted evidence from my resume and an honest fit score.
**Verified:** 2026-10-11T16:05:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

The phase goal is achieved in the code. Every roadmap success criterion is backed by running code, a passing automated test and, for the real-model path, the recorded live spike. Nothing failed. The status is `human_needed` only because four plan-level backstop truths, one judgment-tier prohibition group and the plan 01-11 real-model check cannot be confirmed without a person.

## Gates run at HEAD 2a96c50

| Gate | Command | Result |
| ---- | ------- | ------ |
| Root | `npm run check` (format, lint with `--max-warnings 0`, tsc, vitest, build) | PASS: 235 tests in 13 files, build ok |
| Server | `npm --prefix server run check` | PASS: lint, tsc, 276 tests in 15 files |
| Browser | `npm run e2e` (REAL_AI unset, so the stand-in model) | PASS: 7 of 7 |

No request was sent to Google. `server/.env` was not read. REAL_AI was not set.

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Paste resume text; email, phone, street address and links removed before it is saved or sent; user told | VERIFIED | `PasteForm.tsx` runs `redactContactDetails(canonicaliseResumeText(...))` on first submit, writes the cleaned text back into the box and shows the per-kind counts ("Removed before anything is sent to Google: ..."); `buildResumeRecord` in `resume-store.ts` is the only way a record is built and redacts again. The server repeats it in `prepareResumeForModel` (NFKC, then redact, then tag neutralisation) before the prompt is built. I ran the real function on a resume with 00-prefix and +1 phones, GitHub and LinkedIn links, a street address and an email: all became placeholders, the name stayed. E2E main flow asserts "1 email address, 1 phone number, 1 street address, 1 link" and that the request body contains `[email removed]` and not `example.com`. |
| 2 | "Check my fit" on a seeded job returns, from a real AI model called by the server, every requirement rated met, partial or not evidenced with the resume quote; a rating whose quote is not found becomes not evidenced | VERIFIED | `routes.ts` -> `analyzeFit` -> `createGeminiClient.generateJson` -> `genai.models.generateContent` (`@google/genai` 2.28.0, schema-constrained, model id only in `config/models.ts`). `settle()` withdraws any met or partial rating whose quote fails `verifyQuote` and sets `quoteRejected`. Real model exercised: 01-SPIKE-RESULTS.md records 22 live requests, 19 answered, all schema-valid, 0 rejected quotes, near-perfect pair 6 of 6 required met in every run, poor pair 0. I probed `verifyQuote`: a verbatim bullet with a trailing period passes; `ython scripting`, a placeholder-only quote, a stitched short-segment quote and an invented sentence all fail. E2E "hallucinated_quote" shows the not-evidenced explanation exactly once. |
| 3 | Overall score and band (Strong fit / Good fit / Stretch / Long shot) computed in code from the ratings, labelled as an estimate | VERIFIED | `shared/src/fit/score.ts` `computeFit`: `round(100 x requiredAverage x (0.9 + 0.1 x niceAverage))`, inclusive thresholds 80/60/40, no score when no required items, first-wins duplicate handling shared with the display (`indexRatingsFirstWins`). `fitModelOutputSchema` has no score field, and a test confirms a score in model output never reaches the response. The stored schema has no score or band field. `ScoreBlock` shows "Fit estimate", the percentage, the band and the disclaimer "not a verdict on whether to apply". |
| 4 | Reopening an analysed job, including after a refresh, shows the previous analysis instantly with no new AI call; the resume survives a refresh | VERIFIED | Persisted Zustand stores `jw:analyses` and `jw:resume` (version 1, Zod-validated `merge`, synchronous hydration); the analysis is written from the mutation's `onSuccess`; `selectCurrentAnalysis` is a pure read. E2E main flow reloads, selects the job, sees 6 plus 2 rows and the same score, and asserts the `/api/fit` request count stays at 1. `FitPanel.test.tsx` asserts that rendering never starts a request. |
| 5 | User is told plainly that our server reads the resume without storing or logging it and that Google processes it; the AI key never appears in the browser; a failed or unconfigured call shows one clear, retryable message | VERIFIED (with the WR-06 caveat below) | `PrivacyNote.tsx` is always rendered in `ResumeCard` and says the server does not store or log the resume and that Google processes the text; the paid-tier paragraph ships on the recorded billing decision. Key custody: `GEMINI_API_KEY` is read only in `server/src/config/env.ts`; `src/`, `shared/`, `vite.config.ts` and `index.html` contain only the plain name inside the set-up message; the built `dist` bundle has 0 matches for `AIza`, `VITE_` and `GEMINI_API_KEY=`; the SDK is a dependency of `server/` only; `server/.env` is git-ignored and `.env.example` holds the name with no value. `e2e/no-secrets.spec.ts` scans every document, script, stylesheet and API response. A failure shows "Something went wrong on our side. Try again." with a Try again button; unconfigured shows the set-up message with no retry; health tells the page before the user clicks. |

### Plan-level truths (summary by plan)

| Plan | Truths | Status | Notes |
| ---- | ------ | ------ | ----- |
| 01-01 workspace, SDK pin, config | 5 | VERIFIED | Single root lockfile; `@google/genai` exactly 2.28.0 in `server/package.json` only; shared tests run in the root gate (13 files include `shared/`). |
| 01-02 tracer, server | 7 | VERIFIED | `routes.test.ts`: simultaneous requests with different resumes get quotes only from their own; 503 `ai_not_configured` without a model call; 502 after exactly one upstream request on block, truncation, empty, malformed, 5xx, 429 and missed deadline; `strictObject` request schema rejects unknown fields; `advice: null` and `profile: null` reserved in the stored contracts. |
| 01-03 tracer, browser | 6 | VERIFIED | E2E main flow; no request on load, select or refresh; same-origin `/api` only; e2e uses its own ports 3101 and 3199 with `reuseExistingServer: false`; health reports `aiConfigured`. |
| 01-04 contact removal | 4 | VERIFIED | Shared `redact.ts` runs in the browser and on the server; idempotent; closing `</resume>` or `</job>` tags in a resume are neutralised (routes test: exactly one resume block upstream). |
| 01-05 seed jobs and stub page | 10 (+1 backstop) | VERIFIED (10), backstop pending | Nine jobs with stable hand-assigned ids, 5 to 7 required and 2 to 3 nice-to-have each, fictional companies; the shared job schema is parsed at module load so a job with no requirements stops the server; component tests cover empty, loading, error and retry. |
| 01-06 server guards | 6 | VERIFIED | Log line is method, path, status, duration only (tests assert no resume text, no query string); origin guard runs before the limiter, which runs before body parsing; hand-written limiter at 20 per minute; error responses carry fixed text per code; server binds `127.0.0.1`. |
| 01-07 evidence-checked ratings | 7 | VERIFIED | `analyze.ts` and `quotes.ts` behave as stated, including first-wins on duplicate ids, posting order, out-of-job ids dropped, missing requirement rated not evidenced, quote span across a line break and across line-end hyphenation; the schema sent to the model is walked by `schema.test.ts` for undocumented keywords. |
| 01-08 paste form, resume store | 7 (+1 backstop) | VERIFIED (7), backstop pending | 50 and 60,000 limits are measured on canonical text; CRLF and decomposed accents give the same text and hash; "No resume yet" state. |
| 01-09 live spike | 4 | VERIFIED | `01-SPIKE-RESULTS.md` holds the table, the stated selection rule and spend of about US$0.17 (under US$1). `models.ts` (LOW thinking, 4096 tokens, 30000 ms) matches the rule's output. `spike-live` now needs an explicit `--live` (WR-07) and is capped at 30 requests; no automated gate calls the model. The user-go-ahead truth rests on the narrative in the results file; see the judgment item. |
| 01-10 score and result panel | 10 (+1 backstop) | VERIFIED (10), backstop pending | Boundary scores 79/80, 59/60, 39/40 covered in `score.test.ts`; button is `aria-disabled` while running; failed re-check leaves the earlier result visible; markup in a quote or rationale renders as literal text; re-running replaces the job's entry. |
| 01-11 privacy, AI status, key scan | 4 (+1 backstop) | VERIFIED (4), backstop pending | Note word-for-word test; without the billing flag the paid paragraph is dropped and nothing else changes; health-driven notice and explained button; no-secrets scan. |

**Score:** 75 of 79 verified (5 roadmap criteria plus 70 plan truths). The 4 remaining are `verification: backstop` truths with no committed test or recorded evidence a verifier can rely on; they are routed to human verification and are not counted as verified. Plan truths that restate a roadmap criterion are counted twice here, so read the score as approximate; the four backstop items are exact.

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | Show "Try again" only for retryable failures, and give `forbidden_origin` its own line (WR-06) | Phase 01.1 | Roadmap Phase 01.1 criterion 4 (per-error messages, FIT-11); `deferred-items.md` records the disposition |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `shared/src/{fit.ts,fit/score.ts,resume.ts,job.ts,error.ts,text/redact.ts}` | Shared contracts, score, redaction | VERIFIED | Substantive and imported by both sides |
| `server/src/ai/{client,prepare,schema,diagnose}.ts`, `ai/prompts/fit.ts` | Provider seam, prompt, schema | VERIFIED | Real SDK call; no retry options; key only inside `createGeminiClient` |
| `server/src/fit/{routes,analyze,quotes}.ts` | Route, pipeline, quote check | VERIFIED | Wired in `app.ts` behind the log, origin guard and limiter |
| `server/src/http/*` | Guards and errors | VERIFIED | Wired in fixed order |
| `server/src/jobs/{seed-jobs,seed,routes}.ts` | Nine seed jobs | VERIFIED | Served by `/api/jobs`, schema-validated at load |
| `server/src/scripts/spike-live.ts`, `spike-stats.ts`, `01-SPIKE-RESULTS.md` | Live spike | VERIFIED | Present, tested, results recorded |
| `src/features/resume/*`, `src/features/fit-analysis/*`, `src/features/jobs-stub/*`, `src/App.tsx` | Page | VERIFIED | Used by `App`; greeting feature retired |
| `e2e/check-fit.spec.ts`, `e2e/no-secrets.spec.ts`, `playwright.config.ts`, `server/.env.example` | Browser tests, template | VERIFIED | 7 of 7 pass |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `PasteForm` | `resume-store` / `buildResumeRecord` | redact, validate, hash, save | WIRED |
| `App` -> `JobDetail` -> `FitPanel` | `useCheckFit` -> `apiRequest('/api/fit')` | click handler only | WIRED |
| `useCheckFit.onSuccess` | `useFitStore.saveAnalysis` (hash from click-time variables) | hook-level callback | WIRED |
| `FitPanel` | `selectCurrentAnalysis` / `buildFitView` -> `computeFit` | derived each render | WIRED |
| `/api/fit` route | `analyzeFit` -> `prepareResumeForModel` -> `generateJson` -> `settle` / `verifyQuote` | one call, one pass | WIRED |
| `createApp` | `requestLog` -> `localOrigin` -> jobs -> limiter -> fit router -> error handler | fixed order | WIRED |
| `JobDetail` | `/api/health` (`aiConfigured`) | status notice and button reason | WIRED |
| Browser | Express | Vite `/api` proxy (`API_PROXY_TARGET`) | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
| -------- | ---- | ------ | --------- | ------ |
| `RequirementsSection`, `ScoreBlock` | ratings, score | model output -> `settle` -> response -> persisted store -> `buildFitView` | Yes (stand-in in gates, real Gemini in the spike) | FLOWING |
| `JobPicker`, `JobDetail` | jobs | `/api/jobs` -> seed module | Yes | FLOWING |
| `ResumeCard` | saved resume | persisted store | Yes | FLOWING |
| `JobDetail` notice | `aiConfigured` | `/api/health` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Contact removal on the server path | `prepareResumeForModel` on a synthetic resume (run through tsx, no network) | email, two phone formats, GitHub and LinkedIn links and street all replaced; name, dates and percentages kept | PASS |
| Quote verification | `verifyQuote` on six probes | verbatim and period-tolerant pass; mid-word, placeholder-only, short stitched and invented fail | PASS |
| Seed jobs | `listJobs()` | nine jobs, 5 to 7 required and 2 to 3 nice-to-have, fictional companies | PASS |
| Key not in bundle | grep of `dist/assets/*.js` | 0 matches for `AIza`, `VITE_`, `GEMINI_API_KEY=` | PASS |
| Full journey on the stand-in model | `npm run e2e` | 7 of 7 | PASS |

### Probe Execution

None declared by the plans and none found under `scripts/*/tests/`. SKIPPED. The live spike (`spike:live --live`) is paid and was not run.

### Requirements Coverage

Every ID in the phase and every ID in the plan frontmatter was cross-checked against REQUIREMENTS.md. All eight are mapped to Phase 1, none is orphaned, and none is claimed by a plan without being in the roadmap.

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| RES-02 | Provide a resume by pasting text | SATISFIED | `PasteForm`, `ResumeCard`, persisted store; e2e main flow and short-paste test |
| FIT-01 | "Check my fit" on the open job gives an analysis from a real AI model | SATISFIED | Server route and Gemini client; live spike on the real model |
| FIT-02 | Each requirement rated met, partial or not evidenced, with a quote for met and partial | SATISFIED | `analyze.ts` / `quotes.ts` / `RequirementsSection` |
| FIT-03 | Overall score and band computed from the ratings, labelled an estimate | SATISFIED | `computeFit`, `ScoreBlock` |
| FIT-08 | Previous analysis shown instantly on reopening, no AI call | SATISFIED | `jw:analyses` store; e2e reload asserts one `/api/fit` request in total |
| DATA-01 | Resume and analyses persist across refresh (applications, stages, chat belong to later phases per the roadmap's cross-cutting rule) | SATISFIED for Phase 1 scope | Both stores versioned, validated, hydrated synchronously |
| DATA-06 | Resume sent to the server only to read and to run AI requests, never stored or logged; page says so | SATISFIED | Log, error and limiter code read; `PrivacyNote`. The two-tab backstop sits under this ID and is a human item |
| DATA-07 | AI requests made by the server; key never in the browser | SATISFIED | Key custody trace and the no-secrets scan |

### Anti-Patterns Found

None blocking. No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `eslint-disable` or `@ts-*` suppression in non-test source. Placeholder matches are the `[email removed]` family only.

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| `src/features/fit-analysis/FitPanel.tsx` | Retry button shown for non-retryable codes; `forbidden_origin` (for example Vite on 5174) reads as a generic fault | Warning (deferred to 01.1 by design, WR-06) | Wrong affordance in a setup-error case; does not affect the happy path or any success criterion as worded |
| `src/features/resume/PrivacyNote.tsx` | Server paragraph says the server reads the resume "to pull the text out of a PDF"; no PDF path exists until 01.2 | Info | Fixed UI-SPEC copy covering the union of the three phases; true once 01.2 lands |
| `server/src/fit/routes.ts` | A failed call writes `fit failed status=... category=...` | Info | Fixed-list values, no content; slightly wider than "route, status and duration" in CLAUDE.md. Test asserts no key, resume, prompt or message reaches it |
| Code review IN-01 to IN-05 | Open Info items (duplicate model ids become silent not-evidenced, `GEMINI_BASE_URL` honoured in production, aborted requests unlogged, CI token permissions, hard-coded paid-tier constant) | Info | Out of fix scope by the review's own decision; none affects a Phase 1 criterion |

Code review: WR-01 to WR-05, WR-07 and WR-08 were fixed in the named commits and the fixes are in the code (period tolerance, placeholder exclusion, word-bounded and gap-limited ellipsis segments, NFKC before redaction with 00-prefix phones, failure line, explicit `--live`, first-wins in both score and display). WR-06 is deferred as above.

### Human Verification Required

1. **Real-model main flow (plan 01-11 Task 3).** Test: the user runs `REAL_AI=1 npx playwright test e2e/check-fit.spec.ts -g "main flow"` once, or authorises an agent at that moment; synthetic resume only. Expected: four placeholders shown, ratings with quotes from Google's model, a score and band labelled an estimate, same result after reload with no second fit request, cost a few cents. Why human: paid call with the user's key. Not run here.
2. **Two-tab concurrency (01-08).** Open two tabs, save in one, reload the other. Expected: no error, last write wins. Why human: backstop, no test.
3. **Result panel at 768px (01-10).** A 25-word quote and a 300-character rationale wrap with the left rule intact. Why human: visual; the executor's measurement was a deleted throwaway script.
4. **Privacy note at 768px (01-11).** Paragraphs wrap without clipping. Why human: visual; measured once, no committed test.
5. **100-character job title at 1024px and 768px (01-05).** Wraps, no horizontal scroll. Why human: visual backstop; no fixture has such a title.
6. **Judgment-tier prohibitions (flagged: unverified-prohibition, human review recommended).** The verifier's non-authoritative reading is in the front matter; the user should confirm in particular that the three live runs in `01-SPIKE-RESULTS.md` match what they authorised.

### Gaps Summary

No gaps. No truth failed, no artifact is missing or a stub, no key link is broken, no requirement is unmet or orphaned. One known weakness (WR-06) is a deliberate, recorded deferral to Phase 01.1 with matching roadmap text. Behavior-dependent truths (single upstream request, concurrent isolation, quote withdrawal, no request without a click, replace-not-append on re-run) are each backed by a named passing test, so none is left present-but-unexercised.

Bookkeeping note, not a goal gap: ROADMAP.md still shows the Phase 1 checkbox unticked although its 11 plans are ticked and REQUIREMENTS.md marks all eight IDs Complete.

---

_Verified: 2026-10-11T16:05:00Z_
_Verifier: Claude (gsd-verifier)_
