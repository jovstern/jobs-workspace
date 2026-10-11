---
phase: 01-real-ai-path-end-to-end
plan: 04
subsystem: api
tags: [privacy, redaction, regex, prompt-safety, shared-package, express, vitest]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-02 canonicaliseResumeText, POST /api/fit, fake-gemini lastRequest()"
provides:
  - "redactContactDetails in @jobs-workspace/shared: pure, idempotent, linear-time removal of emails, links, phone numbers and street addresses with four exact placeholders and per-kind counts"
  - "prepareResumeForModel on the server: canonicalise, redact, then neutralise resume and job tags; the one string that is sent to the model"
  - "POST /api/fit builds its prompt only from the prepared text, proven at the HTTP boundary through the stand-in model"
affects: [01-07, 01-08, 01-11]

actuals:
  tokens: 5750
  tasks: 2
  commits: 4
plan_head_before: 75ec6e16f6bc7ddc042b79eaba176d0995d380e7
plan_head_after: fa3cb9edaf34fb29a41af0de576cb29f5fb5273e

tech-stack:
  added: []
  patterns:
    - "Contact removal as an ordered list of rules (email, link, phone, address), each a plain regex that starts at a token boundary, so matching is linear and one pattern never eats part of another"
    - "Phone candidates start behind a digit/word/date boundary lookbehind, so dates, versions and salary ranges are never read as phone numbers"
    - "Server enforcement of a client-side rule: the same shared function runs on the server for every request, so a misbehaving client cannot leak"

key-files:
  created:
    - shared/src/text/redact.ts
    - shared/src/text/redact.test.ts
    - server/src/ai/prepare.ts
    - server/src/ai/prepare.test.ts
  modified:
    - shared/src/index.ts
    - server/src/fit/routes.ts
    - server/src/fit/routes.test.ts

key-decisions:
  - "Tag neutralisation also catches a tag written with spaces inside the bracket (< / resume >), not only the exact form, because a model can read it as a tag"
  - "A US street address is removed together with its optional unit and 'City, ST 12345' tail; a UK postcode is a separate pattern that removes only the postcode, so 'London NW1 6XE' keeps the word London"
  - "Plus-prefixed phone candidates are validated in code (8 or more digits, no spaced hyphen) instead of in the pattern, which keeps the pattern bounded and rejects '+10 000 - 15 000'"

requirements-completed: [RES-02, DATA-06]

coverage:
  - id: D1
    description: "redactContactDetails removes email, phone, street address and link formats and keeps dates, versions, salaries, percentages and technology names, proven by fixtures in both directions"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "shared/src/text/redact.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Removal is idempotent and finishes a 60,000-character adversarial input in well under 200 ms"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "shared/src/text/redact.test.ts#idempotence and speed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whatever the browser sends to POST /api/fit, the upstream request holds no email, phone, street address or link and a resume that closes its own tag still yields exactly one resume block"
    requirement: DATA-06
    verification:
      - kind: integration
        ref: "server/src/fit/routes.test.ts#contact details never reach the model"
        status: pass
      - kind: unit
        ref: "server/src/ai/prepare.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pattern-based removal recognises common formats only; whether that coverage is enough for the privacy promise is the user's call (see Flagged assumptions in the plan)"
    requirement: RES-02
    verification: []
    human_judgment: true
    rationale: "Coverage of real-world address and phone formats cannot be proven by synthetic fixtures; the user reviews pasted text before saving (plan 01-08) and the privacy note states the limit (plan 01-11)"

duration: 5min
completed: 2026-10-11
---

# Phase 01 Plan 04: Contact removal before every model call Summary

**One shared, linear-time `redactContactDetails` removes emails, links, phone numbers and street addresses, and the server runs it (plus resume/job tag neutralisation) inside `prepareResumeForModel` on every fit request, proven by reading what the stand-in model received.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-11T07:20:00Z
- **Completed:** 2026-10-11T07:25:14Z
- **Tasks:** 2 (both TDD: red commit, then green commit)
- **Files modified:** 7

## Accomplishments

- `redactContactDetails` handles every format in the plan's removal list and leaves every item in its keep list byte for byte; the placeholders are exactly `[email removed]`, `[phone removed]`, `[address removed]`, `[link removed]`. A second pass returns the same text with four zero counts for every fixture.
- Patterns have no unbounded nested quantifiers and every match starts at a token boundary. Probes on 60,000-character inputs (digits and dots, dots and at-signs, repeated `http://`, repeated street-like and phone-like groups) all finish in about 1 ms.
- `prepareResumeForModel` = canonicalise, redact, neutralise `<resume` / `</job` style tags (any case, optional spaces) to `[resume` / `[/job`. Its output equals what the browser holds after `canonicaliseResumeText` and `redactContactDetails`, apart from the tag step, and preparing twice changes nothing.
- `POST /api/fit` calls `prepareResumeForModel` exactly once per request and builds the prompt from its result only. Two new route tests read the upstream body through `fake.lastRequest()`: no email, phone, street address or link survives and `[email removed]` is present; a resume containing `</resume>` plus an instruction yields one `<resume>` block and one `</resume>`.

## Task Commits

1. **Task 1: Shared contact-detail removal with fixture tests in both directions**
   - RED `0e65ec3` (test): 89 cases; 19 failed on their assertions against a stand-in that returns the text unchanged (the 70 keep cases passed against it by design, since a no-op keeps everything)
   - GREEN `e4d2d41` (feat): implementation and `shared/src/index.ts` export; all 89 pass
2. **Task 2: Enforce removal on the server before any model call**
   - RED `d2d4d54` (test): 12 failed (10 in `prepare.test.ts`, 2 route cases) against a pass-through stand-in
   - GREEN `fa3cb9e` (feat): `prepare.ts`, route wiring; server suite passes (40 tests)

**Plan metadata:** committed separately with this summary (docs).

## Files Created/Modified

- `shared/src/text/redact.ts` - ordered contact-removal rules with per-pattern comments on what each matches and leaves alone
- `shared/src/text/redact.test.ts` - removal and keep fixtures, idempotence, UK postcode, documented known limit, 60,000-character timing
- `shared/src/index.ts` - exports the new module
- `server/src/ai/prepare.ts` - the single resume-to-prompt-text function
- `server/src/ai/prepare.test.ts` - placeholders, browser equality, tag neutralisation, idempotence
- `server/src/fit/routes.ts` - applies `prepareResumeForModel` before building the prompt
- `server/src/fit/routes.test.ts` - two upstream-request cases

## Decisions Made

See `key-decisions` in the frontmatter. Nothing in the plan was changed; the three choices are implementation details inside the plan's stated behaviour.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route test counted the task reminder's tag names as extra resume blocks**
- **Found during:** Task 2 (GREEN run)
- **Issue:** My RED route test counted every `<resume>` and `</job>` occurrence in the upstream prompt. The plan's unchanged prompt envelope ends with the prose line "Rate every requirement listed in <job> against the text in <resume>.", which adds one more of each, so the assertion failed although the implementation was correct.
- **Fix:** Count only tags that sit on their own line (`/^<resume>$/gim` and the closing forms), which is exactly the structure the envelope uses for its data blocks. The envelope itself was left unchanged, as the plan requires.
- **Files modified:** `server/src/fit/routes.test.ts`
- **Verification:** `npm --prefix server run check` passes; the test still fails against the pass-through stand-in (it was in the 12 RED failures).
- **Commit:** `fa3cb9e`

**Total deviations:** 1 auto-fixed (1 test bug). **Impact:** none on behaviour or scope.

### TDD note

Neither task is `type: tdd` at plan level, so the `test` then `feat` commit pairs follow the task-level `tdd="true"` flag. Each RED commit carries a minimal pass-through stand-in so the target tests fail on their assertions rather than on a missing import. No `refactor` commits were needed. The RED evidence was inspected by hand (Vitest assertion output naming the planned expected and received values); the TAP classifier was not run, and `workflow.tdd_mode` is off in this project.

## Known Limits (carried by the plan's Flagged assumptions, not new)

- Addresses with no street-type word, non-Latin formats, numbers written as words, and personal sites on unknown hosts without a scheme are not recognised.
- `25 Park Avenue project` is removed as an address (recorded as a test). Title-case phrases such as "12 Reusable Components Drive" can also read as an address.
- A UK address with a street and a postcode, such as `10 Downing Street, London SW1A 2AA`, becomes two placeholders around the city word.
- A US-style address without a state and ZIP tail is removed up to the street word or unit only.

## Issues Encountered

None.

## Known Stubs

None. Both RED-phase pass-through stand-ins were replaced in the GREEN commits.

## Threat Flags

None. No new endpoint, auth path or storage was added; the work reduces what crosses the existing Express to Gemini boundary (T-01-13 to T-01-16 mitigations are implemented and tested; T-01-SC: no install).

## Verification Run

- `npx vitest run shared/src/text/redact.test.ts`: 89 passed
- `npm run check`: passed (format, lint, typecheck, 103 tests, build)
- `npm --prefix server run check`: passed (lint, typecheck, 40 tests)
- `npm run e2e`: 1 passed; nothing left listening on 4173, 3101 or 3199

## Next Phase Readiness

Plan 01-07 can verify quotes against `prepareResumeForModel(text)`; plan 01-08's paste form can call `redactContactDetails` directly and show the summary from `counts`. Ready for the next plan in the phase.

## Self-Check: PASSED

- Files exist: `shared/src/text/redact.ts`, `shared/src/text/redact.test.ts`, `server/src/ai/prepare.ts`, `server/src/ai/prepare.test.ts` (checked below)
- Commits `0e65ec3`, `e4d2d41`, `d2d4d54`, `fa3cb9e` are ancestors of HEAD (checked below)
