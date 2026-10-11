---
status: complete
phase: 01-real-ai-path-end-to-end
source: [01-VERIFICATION.md]
started: 2026-10-11T12:55:00Z
updated: 2026-10-11T13:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real-model main flow in a browser (plan 01-11 Task 3)
expected: Paste the synthetic resume, check fit against real Gemini, see rated requirements with quotes and a score; refresh keeps the result.
result: pass
note: The user was given the commands to run the app and the `REAL_AI=1` browser test and replied "looks good, continue". The orchestrator did not run the `REAL_AI=1` test itself (no explicit go-ahead for another paid call), so no real-model recording exists; the real model was exercised by the live spike (22 requests, see 01-SPIKE-RESULTS.md).

### 2. Two-tab concurrency (plan 01-08 backstop)
expected: Save a resume in one tab, reload the other; it shows the saved resume with no error.
result: pass
note: Checked by the orchestrator in Chromium with a throwaway Playwright script (stand-in model).

### 3. Result panel at 768px (plan 01-10 backstop)
expected: Long quotes and rationales wrap, the quote's left rule stays intact, no horizontal overflow.
result: pass
note: Checked by the orchestrator at 768px and 1024px; document scroll width equals client width; screenshot reviewed.

### 4. Privacy note at 768px (plan 01-11 backstop)
expected: All four paragraphs wrap without clipping.
result: pass
note: Checked by the orchestrator at 768px and 1024px; screenshot reviewed.

### 5. 100-character job title at 1024px and 768px (plan 01-05 backstop)
expected: The title wraps in the job list, the detail heading and the fit heading without overflow.
result: pass
note: Checked by the orchestrator with a 100-character title injected into the jobs response.

### 6. Judgment-tier prohibitions and live-run history
expected: The live runs recorded in 01-SPIKE-RESULTS.md match what the user authorised (two runs refused with 403, one measuring run of 22 requests).
result: pass
note: Each live run followed a go-ahead the user gave in the session. The user was asked to confirm the history explicitly and replied "looks good, continue" without contradicting it.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. Deferred by design: code review WR-06 (retry offered for non-retryable errors) to Phase 01.1.
