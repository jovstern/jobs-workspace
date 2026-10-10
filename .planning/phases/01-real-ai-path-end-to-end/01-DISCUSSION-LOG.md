# Phase 1: Real AI path, end to end - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-10
**Phase:** 1-Real AI path, end to end
**Areas discussed:** AI provider (pre-discussion), Resume review step, Score and "I do have this", First seed jobs, Gemini tier and PDF fallback

---

## AI provider (raised before the phase questions)

The user started the milestone with the note "I added new .env file with gemini api key". The
plan until then assumed Claude.

| Option                         | Description                                                                 | Selected |
| ------------------------------ | --------------------------------------------------------------------------- | -------- |
| Switch to Gemini               | Use the Gemini API with the supplied key; redo the provider-specific research | ✓        |
| Stay with Claude               | Keep the plan as researched; user adds an Anthropic key                     |          |
| Provider-agnostic, Gemini first | One server interface, Gemini now, room for Claude later                     |          |

**User's choice:** Switch to Gemini. Key variable name: `GEMINI_API_KEY`.
**Notes:** Asked whether anything else had changed since kickoff; the user said no.

---

## Resume review step

| Question     | Options                                                                       | Selected                       |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------ |
| Editable     | Text first, then profile / Profile only / Text only                           | Text first, then profile       |
| Profile      | Lean / Fuller (adds education, certifications, languages) / Skills only       | Lean                           |
| Contact info | Remove before sending / Send as written / Warn and let the user decide        | Remove before sending          |
| Re-parse     | Ask on save / Always rebuild / Never automatically                            | Ask on save                    |

**User's choice:** The recommended option in all four.
**Notes:** None.

---

## Score and "I do have this"

| Question   | Options                                                             | Selected            |
| ---------- | ------------------------------------------------------------------- | ------------------- |
| Weighting  | Required dominate / Equal weight / Required only                    | Required dominate   |
| Bands      | Encouraging bands / Neutral bands / Counts, no percentage           | Encouraging bands   |
| Remembered | Add to my profile / This job only / Ask each time                   | Add to my profile   |
| Credit     | Full, clearly marked / Partial credit / Two scores                  | Full, clearly marked |

**User's choice:** The recommended option in all four.
**Notes:** None.

---

## First seed jobs

| Question     | Options                                                                          | Selected                          |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------- |
| Seed jobs    | Software roles, mixed levels / Broad mix of professions / Tailored to my field   | Software roles, mixed levels      |
| Requirements | 6-10, as written in the post / Fewer, broader (4-5) / More, finer (12-15)        | 6-10, as written in the post      |

**User's choice:** The recommended option in both.
**Notes:** None.

---

## Gemini tier and PDF fallback

| Question    | Options                                                              | Selected            |
| ----------- | -------------------------------------------------------------------- | ------------------- |
| Gemini tier | Free tier / Paid tier / Not sure                                     | Paid tier           |
| Scanned PDF | Let Gemini read it / Ask the user to paste / Always let Gemini read it | Let Gemini read it  |

**User's choice:** Paid tier; local extraction first with Gemini as the fallback.
**Notes:** None.

---

## Process note

The four areas were asked as grouped question sets (two to four questions per turn) instead of
one question per turn, and the per-area "more questions or next area?" prompt was replaced by a
single closing prompt, to which the user answered "I'm ready for context".

## Claude's Discretion

- Exact score formula, band thresholds and bonus size
- Detection of unreadable PDFs
- Upload size and page limits
- One fit call or split, by measured latency
- Plain layout of the stub page, review step presentation and fit panel
- Whether shared schemas live in a workspace package (to be stated in the plan summary)

## Deferred Ideas

- Education, certifications and languages in the profile
- Non-software seed jobs (Phase 2 dataset)
- A provider-agnostic AI interface
