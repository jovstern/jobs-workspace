---
phase: 01-real-ai-path-end-to-end
reviewed: 2026-10-11T00:00:00Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - .github/workflows/ci.yml
  - e2e/check-fit.spec.ts
  - e2e/no-secrets.spec.ts
  - package.json
  - playwright.config.ts
  - server/.env.example
  - server/package.json
  - server/src/ai/client.ts
  - server/src/ai/diagnose.ts
  - server/src/ai/prepare.ts
  - server/src/ai/prompts/fit.ts
  - server/src/ai/schema.ts
  - server/src/app.ts
  - server/src/config/env.ts
  - server/src/config/models.ts
  - server/src/fit/analyze.ts
  - server/src/fit/quotes.ts
  - server/src/fit/routes.ts
  - server/src/http/errors.ts
  - server/src/http/local-origin.ts
  - server/src/http/rate-limit.ts
  - server/src/http/request-log.ts
  - server/src/index.ts
  - server/src/jobs/routes.ts
  - server/src/jobs/seed-jobs.ts
  - server/src/jobs/seed.ts
  - server/src/scripts/spike-live.ts
  - server/src/test-support/fake-gemini.ts
  - shared/package.json
  - shared/src/error.ts
  - shared/src/fit.ts
  - shared/src/fit/score.ts
  - shared/src/health.ts
  - shared/src/index.ts
  - shared/src/job.ts
  - shared/src/resume.ts
  - shared/src/text/redact.ts
  - src/App.tsx
  - src/features/fit-analysis/FitPanel.tsx
  - src/features/fit-analysis/RequirementsSection.tsx
  - src/features/fit-analysis/ScoreBlock.tsx
  - src/features/fit-analysis/fit-store.ts
  - src/features/fit-analysis/mutations.ts
  - src/features/fit-analysis/selectors.ts
  - src/features/jobs-stub/JobDetail.tsx
  - src/features/jobs-stub/JobPicker.tsx
  - src/features/jobs-stub/queries.ts
  - src/features/resume/PasteForm.tsx
  - src/features/resume/PrivacyNote.tsx
  - src/features/resume/ResumeCard.tsx
  - src/features/resume/resume-store.ts
  - src/lib/api.ts
  - src/lib/query-client.ts
  - src/lib/sha256.ts
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 0
  warning: 8
  info: 5
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 62 non-test source and configuration files (test files read only to judge coverage)
**Status:** issues_found

## Summary

The privacy and paid-call properties hold up well. I traced these and found them sound:

- The origin guard runs ahead of the rate limiter, which runs ahead of body parsing.
- The server binds to loopback only.
- The request log records method, path, status and duration only. It never reads the body.
- Error responses carry fixed messages per code.
- The `@google/genai` SDK does not retry when `retryOptions` is unset (verified in the installed 2.28.0 source).
- Mutations are `retry: false` and `networkMode: 'always'`.
- A paid call starts only from a click handler.
- `FitPanel` is keyed by job, so one job's error or result cannot leak into another.
- The score is computed in code, and `computeFit` is a pure function with correct inclusive band edges.
- The redaction regexes ran in under 10 ms on 60,000-character adversarial inputs (no ReDoS).

No finding rises to a blocker. The weaknesses are in two places.

1. **Quote verification** is both too strict (valid quotes rejected) and too lax (non-evidence accepted). I confirmed each case by running the real functions.
2. **Contact removal** misses several common phone formats and full-width characters. These details would reach Google, although the privacy note does hedge with "where we can recognise them".

The server also has no way to learn why a paid call failed in production.

## Warnings

### WR-01: A trailing period on an otherwise verbatim quote gets valid evidence rejected

**File:** `server/src/fit/quotes.ts:28-30, 49`
**Issue:** `SEPARATOR_RUN` keeps `.` as a significant character, but removes `,` `:` `;` `!` `?` and brackets. A model that copies a resume bullet and adds sentence punctuation (very common) fails verification when the resume line has no final period.

I ran this against the real functions. The resume line `- Reduced page load time by 40%` followed by a newline is rejected for the quote `Reduced page load time by 40%.`. It is accepted for the quote without the period. The same happens for `Built a design system used by 12 teams.`

A `met` or `partial` rating is then withdrawn. The user sees "The AI cited text we could not find in your resume", which is false, and the score is understated. The 22-call live spike recorded zero rejections on one resume whose bullets probably end in periods. Resumes with bare bullets are common, so this will show up in real use.

**Fix:** Treat `.` as a separator when it is not inside a token. For example, in `collapse`, strip leading and trailing `.` from each whitespace-delimited token after the replace:
```ts
function collapse(canonical: string): string {
  return canonical
    .toLowerCase()
    .replace(SEPARATOR_RUN, ' ')
    .split(' ')
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token !== '')
    .join(' ')
}
```
This keeps `node.js`, `3.8` and `c++`, and drops sentence-final periods on both sides. Add a test for the bullet-without-period case.

### WR-02: A placeholder is accepted as resume evidence

**File:** `server/src/fit/quotes.ts:79-87`, `server/src/fit/analyze.ts:49`
**Issue:** The quote is checked against the redacted text, so the placeholders `[email removed]`, `[phone removed]`, `[address removed]` and `[link removed]` are part of the searchable text. Verified: `verifyQuote('[email removed]', index)` returns `true` (15 characters, over `MIN_QUOTE_LENGTH`), and so does `Contact: [email removed]`.

A model that returns `met` with a placeholder as its quote passes. The user is shown "From your resume: [email removed]" as the evidence for a requirement.

**Fix:** In `settle`, or in `verifyQuote`, remove placeholder tokens from the quote before measuring its length. Reject the quote when what is left is under `MIN_QUOTE_LENGTH`. A simple version: `quote.replace(/\[(?:email|phone|address|link) removed\]/gi, '')`, then apply the existing rules. Export the placeholder list from `shared/src/text/redact.ts` so the two stay in sync.

### WR-03: Ellipsis quotes and mid-word matches can pass as "a quote from the resume"

**File:** `server/src/fit/quotes.ts:66-87`
**Issue:** Two weaknesses:

1. A quote with `...` is accepted when its segments occur in order anywhere in the resume. The length check is the sum over all segments, with no minimum per segment and no limit on the gap. `React ... AWS ... Kubernetes` verifies against a resume where those words sit in unrelated lines. The UI then renders the stitched string under "From your resume:". It is not contiguous resume text.
2. Matching is a plain `indexOf` on the normalised string, with no word boundary. `ython scripting for` verifies.

Both let an invented or stitched quote through a check whose stated contract is "a quote either occurs in the text or it does not".

**Fix:**
- Require each segment to be at least about 4 normalised characters.
- Require segments to be near each other (for example, within 200 characters of the previous segment's end).
- Anchor each match on word boundaries, either by padding the haystack and needle with spaces or by checking `text[at - 1]` and `text[at + len]`. Then `ython scripting for` fails.

### WR-04: Contact removal misses common phone formats and full-width characters

**File:** `shared/src/text/redact.ts:72-88`, `shared/src/resume.ts:14`, `server/src/ai/prepare.ts:14-15`
**Issue:** I ran the real redactor. These are sent to Google unchanged:

- `0044 20 7946 0958` and `00972 50 123 4567`. The `00` international prefix is common in Europe and the Middle East. The seed jobs are in Lisbon and other European cities, so this is not exotic.
- A bare 10-digit number such as `5550100100`.
- Full-width digits and at-sign (`０５０１２３４５６７８`, `jane＠x.com`). Redaction runs after `canonicaliseResumeText`, which uses NFC. Quote matching later uses NFKC (`quotes.ts:38`), so the two stages disagree about what counts as the same character.

The privacy note and the review notice do say "common formats only", but the server's contract is "contact removal applied before every model call". The server is the last line of defence, because the browser step can be skipped by anyone calling the API.

**Fix:**
- Apply `normalize('NFKC')` before redaction, in `prepareResumeForModel` only. NFKC would change the user's saved text if the browser did it too.
- Add `00\d{1,3}[ .-]\d...` to the phone rules.
- Decide explicitly about bare 10-digit runs (`(?<!\d)\d{10}(?!\d)` with a check that it is not a year range or ID).
- Add test cases for each.

### WR-05: Production failures leave no diagnostic, although the safe diagnostic already exists

**File:** `server/src/fit/routes.ts:33-41`, `server/src/http/errors.ts:73-83`, `server/src/index.ts:17-27`
**Issue:** `generateJson` supports `onFailure`, which reports an HTTP status, a category and an error class only (designed to be safe). The route never passes it. Only the spike script does.

`errorHandler` also swallows every non-`AppError` without a log line. So when a real user gets `ai_failed` (502) or `internal_error` (500), the operator sees only `POST /api/fit 502 1234ms`. A bad key (`UNAUTHENTICATED`), exhausted quota (`RESOURCE_EXHAUSTED`), a blocked prompt and a schema mismatch are all indistinguishable. Debugging the paid path in the field is guesswork, and the pressure will be to add ad-hoc logging that does leak content.

**Fix:** Thread `log` into `createFitRouter` and pass
```ts
onFailure: (d) => log(`fit failed status=${String(d.httpStatus)} category=${d.category} class=${String(d.errorClass)}`)
```
into `analyzeFit`. In `errorHandler`, log only `appError.code` and the route, never `error.message` or the stack. Both values come from fixed lists, so the "route, status and duration only" rule is kept in spirit. State that in CLAUDE.md's rule, or log the code on the same request-log line.

### WR-06: The fit error UI ignores `retryable` and the error code

**File:** `src/features/fit-analysis/FitPanel.tsx:48-50, 114-122`
**Issue:** `ApiError` carries `code` and `retryable`, but the panel shows the generic message for everything except `ai_not_configured`, and always offers "Try again". Consequences:

- `forbidden_origin` (403), `validation_error`, `unsupported_media_type` and `payload_too_large` are all non-retryable, yet a retry button is shown.
- A very likely developer situation is Vite choosing 5174 because 5173 is busy. The Origin is then not in `DEFAULT_ALLOWED_ORIGINS`, and every fit check fails with "Something went wrong on our side", which is wrong. The fault is in the local setup, and nothing points to it.

The per-error message table is deferred to Phase 01.1, but showing a retry button for a non-retryable code is already incorrect in this phase.

**Fix:** Show "Try again" only when `failure instanceof ApiError ? failure.retryable : true`. For `forbidden_origin`, use a specific line such as "The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS."

### WR-07: `npm run spike:live` with no arguments starts a paid run

**File:** `server/src/scripts/spike-live.ts:396-401`
**Issue:** `parseMode([])` returns `'live'`. The header comment says "run it by hand, once", but the safe default is the opposite of the dangerous one. Running `npm --prefix server run spike:live` by habit, or via shell history or an editor task, makes up to 30 paid Gemini calls with the real key from `server/.env`. The code takes care that "a typo must never fall through into a paid run", but an omitted flag does.

**Fix:** Require an explicit `--live` flag. Make no flag print usage and exit 2. Update the header comment and the plan summary accordingly.

### WR-08: Display and score can disagree on stored duplicate rating rows

**File:** `src/features/fit-analysis/selectors.ts:39`, `shared/src/fit/score.ts:40-43`
**Issue:** `buildFitView` builds `ratingById` from `new Map(entries)`, so the **last** duplicate wins. `computeFit` keeps the **first** duplicate. `storedAnalysisSchema` permits duplicate `requirementId`s, and the stored value is untrusted (persisted, user-editable). The server never produces duplicates, so this needs damaged or edited storage.

If that happens, the badge shown for a requirement can differ from the one that went into the score on the same screen.

**Fix:** Use one rule in both places. Either keep first-wins in `buildFitView`, or reject duplicate ids in `storedAnalysisSchema` with a `.refine`. The refine is better: storage that does not validate is then ignored with the existing path.

## Info

### IN-01: A missing or duplicated model rating becomes a silent "not evidenced"

**File:** `server/src/fit/analyze.ts:45-46, 84-91`
**Issue:** The output schema forces exactly `ids.length` ratings, but not distinct ids. If the model repeats one id and omits another, the omitted requirement is shown as "Not evidenced" with an empty rationale and no flag, and the score drops for something the AI never judged. It is indistinguishable from a real "no evidence".
**Fix:** Count requirements with no model answer, and fail the call (`ai_failed`, so the user can retry) or mark the row visibly. A `.refine` for distinct ids in `fitModelOutputSchema` would turn it into the existing `schema_mismatch` path.

### IN-02: The production entry point honours `GEMINI_BASE_URL`

**File:** `server/src/index.ts:8-14`, `server/src/config/env.ts:23-25`
**Issue:** The variable is described as test-only. If it is ever set in a real environment (for example, left in a shell profile or CI secret), the API key and every resume go to that host, and the privacy note becomes false. `.env.example` does not mention it, which is correct, but nothing enforces it.
**Fix:** Accept a base URL only if its host is loopback. Alternatively, print a visible warning at start-up when it is set (value not printed).

### IN-03: The request log omits requests the client aborts

**File:** `server/src/http/request-log.ts:15-17`
**Issue:** Only `finish` is listened to. A request whose client disconnects during the 30-second model call (the `abort` path in `routes.ts`) fires `close` without `finish`, so it is never logged. Those are exactly the calls that were billed but not delivered.
**Fix:** Also log on `close` when `!res.writableEnded`, with status `aborted`. Guard against double-logging.

### IN-04: CI has no explicit token permissions

**File:** `.github/workflows/ci.yml:1-12`
**Issue:** There is no top-level `permissions:` block, so the default `GITHUB_TOKEN` scope (repository setting dependent) applies to a job that only needs to read. Actions are pinned by tag, not commit SHA.
**Fix:** Add `permissions: { contents: read }`. Consider SHA pinning. Adding it changes CI configuration, so ask the user first per CLAUDE.md.

### IN-05: The paid-tier privacy paragraph is a hard-coded constant

**File:** `src/features/resume/PrivacyNote.tsx:3-7`
**Issue:** The claim "Google says it does not use this content to improve its products" depends on billing being active on the key's project. It is recorded as confirmed on a date, as a source constant, with no runtime check. If billing lapses the claim silently becomes untrue, and the developer-facing comment is the only safeguard. This was recorded as a deliberate decision in plan 01-11, so it is not a defect to fix now, only a reminder.
**Fix:** None needed in Phase 1. Revisit when the settings or key-status UI arrives.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
