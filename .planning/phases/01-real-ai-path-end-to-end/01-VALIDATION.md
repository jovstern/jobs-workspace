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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | See research map | — | — | — | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `shared/` workspace package `@jobs-workspace/shared` wired into root and server, root Vitest include extended
- [ ] `server/src/test-support/fake-gemini.ts` and its npm script (deterministic stand-in for the model)
- [ ] Synthetic resume corpus under `e2e/fixtures/resumes/` and `server/data/seed-jobs.json`, authored together
- [ ] `src/lib/persisted-store.ts` and its tests
- [ ] `src/test/setup.ts` clears `localStorage` after each test
- [ ] Playwright `webServer` array with the API on its own port, never reusing a running server
- [ ] Existing health test updated for the new response shape

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
