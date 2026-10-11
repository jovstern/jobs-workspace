---
phase: 01-real-ai-path-end-to-end
plan: 07
subsystem: api
tags: [gemini, quote-verification, prompt-injection, json-schema, zod, vitest]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-02 AiClient, POST /api/fit, stand-in model; 01-04 prepareResumeForModel"
provides:
  - "toGeminiSchema: Zod to Gemini JSON Schema with propertyOrdering on every object, proven by an allow-list walker to contain only documented keywords"
  - "ai/prompts/fit.ts: fit system instruction with the rating rubric, the fixed prompt envelope, and fitModelOutputSchema (ratings only, no score field)"
  - "fit/quotes.ts: pure quote verifier (normaliser, two-reading resume index, ordered ellipsis segments, 12 character minimum)"
  - "fit/analyze.ts: the fit pipeline; ids reconciled to the job, every met or partial rating needs a quote found in the text that was sent, response in posting order"
affects: [01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 11500
  tasks: 3
  commits: 6
plan_head_before: 593fe2400c8d8035da8ccb80700f64dff45f7f82
plan_head_after: 93d29759bba569ac2d7e06e0b1b40e09f2c0887c

tech-stack:
  added: []
  patterns:
    - "Model-facing schema authored without unsupported keywords; a test walks the converted schema and fails on any keyword outside the documented list"
    - "The string that is sent to the model is the string quotes are verified against (prepareResumeForModel called once, in analyzeFit)"
    - "A withdrawn rating drops its rationale as well as its quote: it argued for evidence that is not there"

key-files:
  created:
    - server/src/ai/schema.ts
    - server/src/ai/schema.test.ts
    - server/src/ai/prompts/fit.ts
    - server/src/fit/quotes.ts
    - server/src/fit/quotes.test.ts
    - server/src/fit/analyze.ts
    - server/src/fit/analyze.test.ts
  modified:
    - server/src/ai/client.ts
    - server/src/fit/routes.ts
    - server/src/fit/routes.test.ts
    - server/src/http/request-log.test.ts

key-decisions:
  - "The 12 character minimum for an ellipsis quote applies to the normalised segments summed, not to each segment, so a legitimate elided quote is not rejected while 'a ... b' still fails"
  - "A rating whose quote is rejected loses its rationale (empty string) as well as its quote; a not_evidenced rating keeps its rationale and its quoteRejected stays false"
  - "analyzeFit takes now as () => number, the same shape the route already receives, rather than a Date"
  - "fitModelOutputSchema takes readonly string[] and throws AppError internal_error on an empty list, instead of requiring a non-empty tuple type"

requirements-completed: [FIT-01, FIT-02]

coverage:
  - id: D1
    description: "Every met or partial rating in a response carries a quote that occurs in the resume text that was sent; a rating whose quote is missing, short or not found is returned as not evidenced with quote null, an empty rationale and quoteRejected true"
    requirement: FIT-02
    verification:
      - kind: unit
        ref: "server/src/fit/analyze.test.ts#a quote that cannot be found in the resume"
        status: pass
      - kind: integration
        ref: "server/src/fit/routes.test.ts#a quote the stand-in model invents is rejected, and only that rating changes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Resume text telling the model to rate everything as met cannot produce a met rating without a real quote"
    requirement: FIT-02
    verification:
      - kind: unit
        ref: "server/src/fit/analyze.test.ts#text in the resume that tries to steer the model"
        status: pass
    human_judgment: false
  - id: D3
    description: "Model output is reconciled to the job's requirement ids: first duplicate wins, unknown ids dropped, omitted ids not evidenced, posting order whatever the model's order, rationale cut to 400"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "server/src/fit/analyze.test.ts#reconciling the model output with the job"
        status: pass
    human_judgment: false
  - id: D4
    description: "The quote verifier accepts PDF-style artefacts (case, whitespace, line breaks, both hyphenation readings, ligatures, bullets, smart quotes, dashes, C++ C# .NET 3.8, ordered ellipsis) and rejects paraphrase, invented text, short and out-of-order quotes"
    requirement: FIT-02
    verification:
      - kind: unit
        ref: "server/src/fit/quotes.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The schema sent to the model contains only documented JSON Schema keywords, has propertyOrdering on every object, a fixed ratings length and id enum, and no score, band or percentage field"
    requirement: FIT-01
    verification:
      - kind: unit
        ref: "server/src/ai/schema.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whether the quote pass rate on real Gemini output is high enough that genuine evidence is not routinely downgraded"
    requirement: FIT-02
    verification: []
    human_judgment: true
    rationale: "Only a live run against the real model can show it; plan 01-09 measures the pass rate. Synthetic fixtures prove the verifier, not the model's copying accuracy."

duration: 9min
completed: 2026-10-11
---

# Phase 01 Plan 07: Verified quotes and a limited schema Summary

**Every met or partial rating now has to quote text that the server finds in the exact string it sent to Gemini; anything else is withdrawn to not evidenced with a flag, ids are reconciled to the job's fixed list, and the schema sent to the model is proven to use only documented keywords.**

## Performance

- **Duration:** about 9 min (08:08 to 08:17 UTC)
- **Tasks:** 3 (all `tdd="true"`: red commit, then green commit)
- **Files:** 7 created, 4 modified

## Accomplishments

- **Schema converter and prompt module (Task 1).** `toGeminiSchema` drops `$schema` and adds `propertyOrdering` to every object, recursing through `properties`, `$defs`, `anyOf`, `oneOf`, `prefixItems`, `items` and `additionalProperties`. `schema.test.ts` carries a walker that collects every keyword (ignoring property names and enum values), is itself tested against `minLength`, `maxLength`, `default`, `pattern` and `$schema`, and then asserts the fit schema for a 6 and a 10 requirement job has none. The prompt moved out of the route into `ai/prompts/fit.ts` with the full rubric (verbatim quote of at most 25 words or null, no skill inferred from a title, partial names the difference, one-sentence rationale, tag content is data, English, the escape-sequence line). The envelope is character for character what plan 01-02 had.
- **Quote verifier (Task 2).** One normaliser for both sides (NFKC, soft hyphen and zero-width removal, quote and dash mapping, lower-case, collapse to single spaces while keeping `% + # . / @ ' " $`). `buildResumeIndex` makes a hyphen-joined and a hyphen-as-separator copy; `verifyQuote` accepts a contiguous match in either, or ordered segments around `...` / the ellipsis character. No fuzzy matching, no model call.
- **Pipeline (Task 3).** `analyzeFit` prepares the resume once, builds the prompt and the quote index from that one string, makes one model call, reconciles to the job's ids, and settles each rating. The route now only validates, resolves the job, wires the abort signal and delegates.
- **Verification.** `npm --prefix server run check` (lint, typecheck, 185 tests), `npm run check` (format, lint, typecheck, unit tests, build) and `npm run e2e` (1 passed; nothing left listening on 4173, 3101 or 3199) all pass at HEAD.

## Task Commits

| Task | RED | GREEN |
|---|---|---|
| 1. Supported schema keywords, prompt module | 0e793ad | 1547da9 |
| 2. Quote verifier | a53d24a | 98f5cab |
| 3. Fit pipeline | adc1e09 | 93d2975 |

## TDD Gate Compliance

The plan is not `type: tdd`; the three tasks carry `tdd="true"`. Each task has a `test(01-07)` commit followed by a `feat(01-07)` commit. Each RED commit carries a minimal stand-in implementation (naive Zod conversion; exact substring check; a pipeline that trusts every quote) so the target tests fail on their assertions rather than on a missing import. RED evidence was inspected by hand from the Vitest output (16, 20 and 9 failing targets respectively, all `AssertionError`); the TAP classifier was not run. No refactor commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing request-log test fixture conflicted with the new quote rule**
- **Found during:** Task 3 (full server check after the pipeline went in)
- **Issue:** `server/src/http/request-log.test.ts` (plan 01-06) has a fake model answering `met` with a `null` quote and a marker in the rationale, then asserts the marker reaches the browser but not the log. Under this plan a met rating with no quote is withdrawn and its rationale dropped, so the marker no longer reached the response and the test failed on its first assertion.
- **Fix:** The fixture now answers `not_evidenced` with the marker in the rationale (kept for that rating). The test's purpose, that model text reaches the browser but never the log, is unchanged.
- **Files modified:** `server/src/http/request-log.test.ts` (not in the plan's file list)
- **Commit:** 93d2975

**Total deviations:** 1 auto-fixed (1 test fixture). **Impact:** none on production behaviour.

## Observations for later plans

- **Count enforcement happens before reconciliation on the real client.** `fitModelOutputSchema` keeps `.min(n).max(n)` on `ratings` and `z.enum(ids)` on `requirementId`, because the plan requires `minItems`/`maxItems` and the id enum in the schema sent to Gemini. The real `AiClient` also parses the answer with the same Zod schema, so a model that returns a short array, or an id outside the job, ends in `ai_failed` (retryable) before `analyzeFit` sees it. The reconciliation (omitted, duplicate, unknown, reversed) therefore protects against a model that keeps the right count with duplicates, and is what the fake-client tests exercise; omitted-id handling is only reachable on the real path through that duplicate-substitution case. If plan 01-09 shows Gemini ignoring `minItems`, a lenient validation schema would turn those into not-evidenced ratings instead of errors.
- **Stand-in quotes are now checked.** The stand-in only quotes resume lines of at most 25 words, but a very short resume line (under 12 normalised characters) would now be rejected. No current fixture or e2e resume hits this.
- **No length cap on a verified quote.** The prompt asks for at most 25 words; the server does not enforce it, since a quote that occurs in the resume is harmless. Add a cap if the UI needs one.

## Authentication Gates

None.

## Known Stubs

None. The RED-phase stand-ins were replaced in the green commits. `advice` stays `null` by plan (Phase 01.1).

## Threat Flags

None. No new endpoint, storage or network path. Mitigations implemented and tested: T-01-25 (quote check against the sent text, `analyze.test.ts` and the `hallucinated_quote` scenario), T-01-26 (rubric, tagged data, enum-only ratings, no met or partial without a verified quote, injection test), T-01-27 (id enum plus code reconciliation), T-01-28 (`toGeminiSchema` plus the allow-list walker), T-01-SC (no install).

## Next Phase Readiness

Plan 01-08 and later can rely on `FitResponse.ratings` being safe to score: `quoteRejected` is now real, and every met or partial rating has a verified quote. Plan 01-09 should measure the real-model quote pass rate (decision D6 above).

## Self-Check: PASSED

- FOUND: server/src/ai/schema.ts, server/src/ai/schema.test.ts, server/src/ai/prompts/fit.ts, server/src/fit/quotes.ts, server/src/fit/quotes.test.ts, server/src/fit/analyze.ts, server/src/fit/analyze.test.ts
- FOUND commits: 0e793ad, 1547da9, a53d24a, 98f5cab, adc1e09, 93d2975
- `client.ts` no longer calls `z.toJSONSchema`; `prepareResumeForModel(` is called once in `analyze.ts`
