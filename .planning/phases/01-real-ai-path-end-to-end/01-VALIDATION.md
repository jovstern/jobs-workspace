---
phase: "1"
slug: "real-ai-path-end-to-end"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-10"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5 (root: jsdom; server: node) + Playwright (chromium, video on) |
| **Config file** | root `vite.config.ts` (test block), server default Vitest config, `playwright.config.ts` |
| **Quick run command** | `npx vitest run <file>` (root) or `cd server && npx vitest run <file>` |
| **Full suite command** | `npm run check && (cd server && npm run check) && npm run e2e` |
| **Estimated runtime** | ~30 seconds per quick run; ~3 minutes full suite |

---

## Sampling Rate

- **After every task commit:** Run the touched file's quick command; `npm run check` where root code changed; `cd server && npm run check` where server code changed
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green, and the manual golden-set run and live-call spike results are recorded
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

Filled by the planner from the requirement-to-test map in `01-RESEARCH.md` §Validation Architecture.

Rows cover Phase 1 after the split (requirements RES-02, FIT-01, FIT-02, FIT-03, FIT-08, DATA-01, DATA-06, DATA-07). Phases 01.1 and 01.2 fill their own maps. Every test file is created by the task that needs it (test first), so no task waits on a separate Wave 0 plan. No row calls the real model.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 1 | DATA-07 | T-01-SC | `@google/genai` 2.28.0 confirmed on the registry before install | blocking human gate | none (checkpoint) | n/a | ⬜ pending |
| 01-01-T2 | 01 | 1 | DATA-07 | T-01-SC, T-01-01 | SDK pinned in the server workspace only; one lockfile; one Zod copy | install check | `npm ci`, `npm ls zod`, `npm ls @google/genai`, `npm --prefix server run check` | ✅ | ⬜ pending |
| 01-01-T3 | 01 | 1 | DATA-07 | — | Shared contract tests run in the root gate | unit (shared) | `npx vitest run shared/src/contracts.test.ts` | ❌ created by this task | ⬜ pending |
| 01-02-T1 | 02 | 2 | FIT-01, DATA-07 | T-01-04 | Request contract is a strict object; no score field in any contract | typecheck and lint | `npm run check` and `npm --prefix server run check` | ✅ | ⬜ pending |
| 01-02-T2 | 02 | 2 | FIT-01, DATA-06, DATA-07 | T-01-03 to T-01-08 | One upstream request per call; every failure typed; extra fields rejected; no key in any response; concurrent requests isolated | server integration (real SDK, stand-in model) | `npm --prefix server run test -- src/fit/routes.test.ts` | ❌ created by this task | ⬜ pending |
| 01-03-T1 | 03 | 3 | DATA-07 | — | Health reports AI status without exposing env values | server route | `npm --prefix server run test -- src/app.test.ts` | ✅ (updated) | ⬜ pending |
| 01-03-T2 | 03 | 3 | FIT-01, FIT-08, DATA-01 | T-01-09 to T-01-12 | No AI request without a click; stored result shown after refresh with no new request; tests never reuse a real API | browser (Playwright) | `npx playwright test e2e/check-fit.spec.ts` | ❌ created by this task | ⬜ pending |
| 01-04-T1 | 04 | 3 | RES-02, DATA-06 | T-01-15, T-01-16 | Contact details and links removed; resume facts kept; idempotent; linear time | unit (shared) | `npx vitest run shared/src/text/redact.test.ts` | ❌ created by this task | ⬜ pending |
| 01-04-T2 | 04 | 3 | DATA-06 | T-01-13, T-01-14 | Server removes contact details before any model call; tags cannot be closed from inside the text | unit and server integration | `npm --prefix server run test -- src/ai/prepare.test.ts src/fit/routes.test.ts` | ❌ created by this task | ⬜ pending |
| 01-05-T1 | 05 | 4 | FIT-01 | T-01-17, T-01-18 | Seed ids pinned; fixtures synthetic only | server unit and integration | `npm --prefix server run test -- src/jobs/seed.test.ts` | ❌ created by this task | ⬜ pending |
| 01-05-T2 | 05 | 4 | FIT-01 | T-01-19 | Job text rendered as text; list states covered | component and browser | `npx vitest run src/features/jobs-stub/JobPicker.test.tsx src/features/jobs-stub/JobDetail.test.tsx` | ❌ created by this task | ⬜ pending |
| 01-06-T1 | 06 | 4 | DATA-06 | T-01-22 | Logs hold method, path, status, duration only; error bodies leak nothing | server integration with marker strings | `npm --prefix server run test -- src/http/request-log.test.ts src/http/errors.test.ts` | ❌ created by this task | ⬜ pending |
| 01-06-T2 | 06 | 4 | DATA-07 | T-01-20, T-01-21 | Foreign origins, rebinding hosts and non-JSON posts refused | server unit | `npm --prefix server run test -- src/http/local-origin.test.ts` | ❌ created by this task | ⬜ pending |
| 01-06-T3 | 06 | 4 | DATA-07 | T-01-23, T-01-24 | Paid route limited to 20 per minute per client; guards wired in a fixed order | server unit and integration | `npm --prefix server run check` | ❌ created by this task | ⬜ pending |
| 01-07-T1 | 07 | 4 | FIT-01 | T-01-28 | Only supported schema keywords are sent to the model | unit | `npm --prefix server run test -- src/ai/schema.test.ts src/fit/routes.test.ts` | ❌ created by this task | ⬜ pending |
| 01-07-T2 | 07 | 4 | FIT-02 | T-01-25 | A quote either occurs in the resume text or it is rejected | unit | `npm --prefix server run test -- src/fit/quotes.test.ts` | ❌ created by this task | ⬜ pending |
| 01-07-T3 | 07 | 4 | FIT-02 | T-01-25 to T-01-27 | Ratings without a verified quote are downgraded; ids reconciled; injection cannot yield a met rating | pipeline unit and server integration | `npm --prefix server run test -- src/fit/analyze.test.ts src/fit/routes.test.ts` | ❌ created by this task | ⬜ pending |
| 01-08-T1 | 08 | 5 | RES-02, DATA-01 | T-01-30 | Stored resume validated on load; stable hash; record built only after contact removal | unit (store) | `npx vitest run src/lib/sha256.test.ts src/features/resume/resume-store.test.ts` | ❌ created by this task | ⬜ pending |
| 01-08-T2 | 08 | 5 | RES-02, DATA-06 | T-01-29 | Nothing saved before contact removal; validation messages; user told what was removed | component | `npx vitest run src/features/resume/PasteForm.test.tsx src/features/resume/ResumeCard.test.tsx` | ❌ created by this task | ⬜ pending |
| 01-08-T3 | 08 | 5 | RES-02, DATA-01, DATA-06 | T-01-29 | Fit request carries contact-free text; resume survives refresh | browser (Playwright) | `npx playwright test e2e/check-fit.spec.ts` | ✅ (updated) | ⬜ pending |
| 01-09-T1 | 09 | 5 | FIT-01 | T-01-32 to T-01-34 | Spike prints numbers and ids only; refuses to run without a key or against a stand-in | unit and dry run (stand-in) | `npm --prefix server run test -- src/scripts/spike-stats.test.ts` and `npm --prefix server run spike:live -- --dry-run` | ❌ created by this task | ⬜ pending |
| 01-09-T2 | 09 | 5 | FIT-01 | T-01-33 | No paid call to the real model without the user's go-ahead immediately before it | blocking human gate | none (checkpoint) | n/a | ⬜ pending |
| 01-09-T3 | 09 | 5 | FIT-01 | T-01-32, T-01-33 | Results file holds no resume or model text; gate does not call the real model | server gate plus manual review | `npm --prefix server run check && test -s .planning/phases/01-real-ai-path-end-to-end/01-SPIKE-RESULTS.md` | ❌ created by this task | ⬜ pending |
| 01-10-T1 | 10 | 6 | FIT-03 | T-01-38 | Score computed in code only | unit (shared) | `npx vitest run shared/src/fit/score.test.ts` | ❌ created by this task | ⬜ pending |
| 01-10-T2 | 10 | 6 | FIT-08, DATA-01 | T-01-36 | A stored result is shown only for the matching resume and job version; store validated on load | unit (selectors, store) | `npx vitest run src/features/fit-analysis/selectors.test.ts src/features/fit-analysis/fit-store.test.ts` | ❌ created by this task | ⬜ pending |
| 01-10-T3 | 10 | 6 | FIT-02, FIT-03, FIT-08 | T-01-35, T-01-37 | Model text rendered as plain text; no implicit paid calls; one retryable failure message | component and browser | `npx vitest run src/features/fit-analysis/FitPanel.test.tsx` and `npx playwright test e2e/check-fit.spec.ts` | ❌ created by this task | ⬜ pending |
| 01-11-T1 | 11 | 6 | DATA-06 | T-01-40 | Paid-tier sentence ships only with the user's billing confirmation | blocking decision | none (checkpoint) | n/a | ⬜ pending |
| 01-11-T2 | 11 | 6 | DATA-06 | T-01-40, T-01-41 | Privacy note wording exact; paid-tier paragraph gated | component | `npx vitest run src/features/resume/PrivacyNote.test.tsx src/features/resume/ResumeCard.test.tsx` | ❌ created by this task | ⬜ pending |
| 01-11-T3 | 11 | 6 | DATA-07 | T-01-39 | No key material in any loaded asset or API response; env template has no values | component and browser | `npx vitest run src/features/jobs-stub/JobDetail.test.tsx` and `npx playwright test e2e/no-secrets.spec.ts` | ❌ created by this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 1 scope after the split. Each item is created by the plan named, as part of a task that needs it; there is no separate Wave 0 plan.

- [ ] `shared/` workspace package `@jobs-workspace/shared` wired into root and server, root Vitest include extended (plan 01-01)
- [ ] `server/src/test-support/fake-gemini.ts` (plan 01-02) and its npm script `fake-gemini` (plan 01-01): the deterministic stand-in for the model
- [ ] The synthetic demo resume `e2e/fixtures/resumes/frontend-senior.txt` and the nine seed jobs in `server/src/jobs/seed-jobs.ts`, authored together (plan 01-05)
- [ ] `src/test/setup.ts` clears `localStorage` after each test (plan 01-08)
- [ ] Playwright `webServer` array with the API on its own port, never reusing a running server (plan 01-03)
- [ ] Existing health test updated for the new response shape (plan 01-03)

Not in Phase 1; these belong to the later phases and are listed here only so nothing reads as dropped:

- Phase 01.1: `src/lib/persisted-store.ts` and its tests (migration and set-aside of corrupted storage, DATA-02); the adversarial resume and the further personas for the golden-set run
- Phase 01.2: PDF fixtures (text, sidebar, image-only, encrypted) and their builder

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real model rates a near-perfect, a middling and a poor fit in the right order | FIT-01, FIT-02 | Needs a live paid call; CI has no key | Run the golden-set script against the real model with the synthetic resumes and record the result |
| Fit analysis latency is acceptable (target under about 15 s) | FIT-11 | Needs a live call | Record p50 and p90 from the live-call spike |
| Privacy note matches the key's billing status | DATA-06 | Billing status is only visible in Google AI Studio | User confirms active billing on the key's project |
| Demo flow with the real model | all | Recorded for the pull request | Run the real-AI tagged Playwright test and review the GIF |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
