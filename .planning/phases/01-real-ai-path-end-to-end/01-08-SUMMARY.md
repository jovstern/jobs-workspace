---
phase: 01-real-ai-path-end-to-end
plan: 08
subsystem: ui
tags: [react, tanstack-form, zod, zustand, persist, redaction, sha256, playwright, vitest]
status: complete

requires:
  - phase: 01-real-ai-path-end-to-end
    provides: "01-04 shared redactContactDetails, canonicaliseResumeText, resumeTextSchema, storedResumeSchema; 01-03/01-05 Button, Card, Notice, JobDetail, FitPanel, fit store"
provides:
  - "sha256Hex: SHA-256 hex of a string through crypto.subtle, no library"
  - "useResumeStore: persisted Zustand store, key jw:resume, version 1, validating merge, profile reserved as null"
  - "buildResumeRecord: the only constructor of a stored resume (canonicalise, remove contact details, validate, hash)"
  - "PasteForm: TanStack Form + Zod paste step with review-then-save and the removal notice; the project's reference form"
  - "ResumeCard: no-resume and saved states with a hidden saved announcement"
  - "Main-flow browser test on the real intake that asserts the /api/fit body is contact-free"
affects: [01-09, 01-10, 01-11]

actuals:
  tokens: 10150
  tasks: 3
  commits: 5
plan_head_before: 5256b77b2cab55323fd1365502564f19e2b96d7f
plan_head_after: e8494c40eb2007640a00ac0cb493de4ebf342010

tech-stack:
  added: []
  patterns:
    - "A stored record has one constructor (buildResumeRecord) so no code path can save or send text that skipped contact removal"
    - "Two-stage paste form: first submit shows the cleaned text and counts, saving runs removal again and only a pass that removes nothing is stored"
    - "Persist merge validates the stored blob with the shared Zod schema and falls back to empty state (same pattern as the fit store)"

key-files:
  created:
    - src/lib/sha256.ts
    - src/lib/sha256.test.ts
    - src/features/resume/resume-store.ts
    - src/features/resume/resume-store.test.ts
    - src/features/resume/PasteForm.tsx
    - src/features/resume/PasteForm.test.tsx
    - src/features/resume/ResumeCard.tsx
    - src/features/resume/ResumeCard.test.tsx
  modified:
    - src/App.tsx
    - src/test/setup.ts
    - e2e/check-fit.spec.ts
    - .claude/skills/stack-conventions/SKILL.md
  deleted:
    - src/features/greeting/GreetingForm.tsx
    - src/features/greeting/GreetingForm.test.tsx

key-decisions:
  - "Approved branch taken (D-20, 'update the path'): greeting form and its test deleted with git rm, and the Forms rule in stack-conventions now names src/features/resume/PasteForm.tsx; nothing else in the skill file changed"
  - "The 'Resume saved.' announcement is filled only after a save in this session (ResumeCard state), so a page load with a stored resume does not announce; the always-rendered empty status region is what lets a screen reader hear the change"
  - "buildResumeRecord throws an Error carrying the first shared validation message rather than a ZodError, so the form can show the shared copy directly"
  - "Textarea is capped at max-h-96 with min-h-64 and vertical resize, so a long paste scrolls instead of growing"

patterns-established:
  - "Component tests that touch the persisted store reset it in beforeEach with setState and read storage through a small helper, because setState itself writes the key"

requirements-completed: [RES-02, DATA-01, DATA-06]

coverage:
  - id: D1
    description: "Pasted text has email addresses, phone numbers, street addresses and links replaced by placeholders before anything is saved or sent, and the user is told how many of each were removed (singular and plural wording, zero kinds omitted)"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "src/features/resume/PasteForm.test.tsx#replaces contact details with placeholders and reports what was removed"
        status: pass
      - kind: unit
        ref: "src/features/resume/PasteForm.test.tsx#uses plural wording and leaves out kinds with a zero count"
        status: pass
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: paste resume, remove contact details, check fit, refresh keeps both"
        status: pass
    human_judgment: false
  - id: D2
    description: "A detail typed back into the reviewed text is removed on Save resume, the notice updates, and nothing is stored until the next click"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "src/features/resume/PasteForm.test.tsx#removes an email address typed into the reviewed text and saves only on the next click"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty, under-50 and over-60,000 character pastes show the shared messages in a role=alert tied to the textarea, and save nothing"
    requirement: RES-02
    verification:
      - kind: unit
        ref: "src/features/resume/PasteForm.test.tsx#shows the short-text message for a paste under 50 characters and saves nothing"
        status: pass
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#a paste that is too short is refused and saves nothing, even after a reload"
        status: pass
    human_judgment: false
  - id: D4
    description: "The saved resume survives a refresh and the fit request carries the saved, contact-free text; the same text with Windows line endings or decomposed accents gives the same saved text and hash"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "src/features/resume/resume-store.test.ts#gives the same text and hash for Windows and Unix line endings"
        status: pass
      - kind: unit
        ref: "src/features/resume/resume-store.test.ts#gives the same text and hash for composed and decomposed accents"
        status: pass
      - kind: unit
        ref: "src/features/resume/resume-store.test.ts#keeps the saved record across a rehydrate, and a second rehydrate changes nothing"
        status: pass
      - kind: e2e
        ref: "e2e/check-fit.spec.ts#main flow: paste resume, remove contact details, check fit, refresh keeps both"
        status: pass
    human_judgment: false
  - id: D5
    description: "With the page open in two tabs, saving in one never leaves the other tab's stored resume or analyses unreadable (last write wins)"
    requirement: DATA-06
    verification: []
    human_judgment: true
    rationale: "Backstop truth in the plan. No cross-tab sync is built; each write stores a complete validated record. Needs a person to open two tabs, save in one and reload the other."

duration: "about 15 min"
completed: 2026-10-11
---

# Phase 1 Plan 08: Paste form, persisted resume and resume card Summary

**A real paste intake: contact details and links are removed in front of the user, the cleaned text is hashed and saved under `jw:resume`, survives a refresh, and is the exact text the fit request carries.**

## Performance

- **Duration:** about 15 min
- **Completed:** 2026-10-11
- **Tasks:** 3 (two with RED then GREEN commits)
- **Files:** 8 created, 4 modified, 2 deleted

## Accomplishments

- `buildResumeRecord` is the single path to a stored resume: canonical text, contact removal, length check on the result, SHA-256. Line endings and Unicode form no longer change the text or the hash.
- `useResumeStore` persists to `jw:resume` (version 1) and validates on load with the shared schema; a wrong-shape value leaves the resume empty. `profile` is stored as null so Phase 01.2 needs no migration.
- `PasteForm` (TanStack Form + Zod) does review then save: first submit shows the cleaned text, the counts notice and the placeholder note; Save runs removal again and stores only when that pass removes nothing.
- `ResumeCard` shows "No resume yet" with the form, or the saved line with the character count, plus the hidden saved announcement. No Review, Replace or Delete button (RES-04 is Phase 01.2).
- `App.tsx` lost its temporary textarea, local state and local hash function; it renders `ResumeCard` and passes the stored resume to `JobDetail`.
- The main browser test now uses the demo resume fixture end to end and asserts the captured `/api/fit` body contains `[email removed]` and neither `example.com` nor the fixture phone number; a second test covers the short-paste message and the empty state after a reload.
- The greeting feature is gone and the stack-conventions Forms rule points at `PasteForm.tsx` (approved branch). This also resolves the 01-05 deferred note about the greeting form's off-contract spacing.

## Task Commits

1. **Task 1 RED:** `08d8523` test(01-08): failing tests for hashing and the resume store (stubs, 9 of 11 fail on assertions)
2. **Task 1 GREEN:** `f0eaf5d` feat(01-08): SHA-256 hashing and the persisted resume store
3. **Task 2 RED:** `4113831` test(01-08): failing tests for the paste form and the resume card (12 of 13 fail on assertions)
4. **Task 2 GREEN:** `5b009ef` feat(01-08): the paste form and the resume card
5. **Task 3:** `e8494c4` feat(01-08): paste form on the page, browser tests, greeting feature retired

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED commits needed compiling stubs**
- **Found during:** Task 1 and Task 2
- **Issue:** The pre-commit hook runs lint and typecheck, and a missing module is not a valid RED (import failure, not an assertion on the planned behaviour).
- **Fix:** Each RED commit carries minimal stub modules (wrong on purpose) so the target tests fail on their assertions; the GREEN commit replaces the stubs.
- **Files modified:** src/lib/sha256.ts, src/features/resume/resume-store.ts, PasteForm.tsx, ResumeCard.tsx (all later rewritten)
- **Commit:** 08d8523, 4113831

**2. [Rule 1 - Bug] Test asserted a null storage key that the test setup itself writes**
- **Found during:** Task 2 GREEN
- **Issue:** `useResumeStore.setState({ resume: null })` in `beforeEach` writes `{"state":{"resume":null}}`, so `localStorage.getItem('jw:resume')` was never null.
- **Fix:** A small `storedResume()` helper reads the stored resume and returns null when absent or null.
- **Files modified:** src/features/resume/PasteForm.test.tsx
- **Commit:** 5b009ef

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** none on scope or behaviour.

## Authentication Gates

None. The browser tests ran against the stand-in model; nothing was sent to Google and `server/.env` was not read.

## Verification

- `npm run check`: format, lint, typecheck, 138 unit tests, build all pass (run before the final commit).
- `npm run e2e`: 2 passed.
- `npm --prefix server run check`: 185 tests pass.
- Acceptance checks: `git ls-files src/features/greeting` prints nothing; the skill file names `src/features/resume/PasteForm.tsx`; `src/App.tsx` contains no `textarea` or `crypto.subtle`; `ResumeCard` renders no button; ports 4173, 3101 and 3199 are free.

## Known Stubs

None. (The RED-commit stubs were replaced in the GREEN commits.)

## Threat Flags

None. The only new surface is the browser-side `jw:resume` key, covered by T-01-29 (single constructor plus the e2e body assertion) and T-01-30 (schema validation in `merge`).

## Open item for a human

- Two-tab backstop (DATA-06): open the page in two tabs, save a resume in one, reload the other and confirm it shows the saved resume with no error.

## Self-Check: PASSED

All created files exist on disk, the five task commits are ancestors of HEAD, and the acceptance criteria above were re-run after the last commit.
