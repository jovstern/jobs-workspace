# Roadmap: Jobs Workspace

## Overview

The journey starts with the riskiest unknown and ends with the user owning their data. Phases 1, 1.1 and 1.2 prove the real AI path on a handful of hand-written jobs in a deliberately plain UI: first a rated fit check on pasted text (1), then gaps, learning plan, tips and failure handling (1.1), then PDF upload, profile review and resume lifecycle (1.2). The original Phase 1 was split into these three during planning because it was too large to plan at full quality. Phase 2 builds the LinkedIn-style three-pane workspace, the design system and full search around it. Phases 3 to 5 deliver the core value in layers: tracking on the same page as search (3), editable stages and close-out (4), then the pipeline strip and nudges (5). Phase 6 adds streaming "ask about this job" chat. Phase 7 gives the user export, import and erase for their browser-only data, plus recovery from lost or corrupted storage.

Every phase ends in something visibly working that a short demo GIF can show. UI and styling are carried by every phase; the shared design tokens and components are established in Phase 2 and reused after it.

**Cross-cutting rules (apply to every phase):**
- Persistence (DATA-01) is mapped to Phase 1, where it first becomes true. Each later phase persists its own data (viewed jobs, applications and stages, chat threads) with the same versioned store pattern, as part of its own success criteria.
- Search and selection state must survive every action (WORK-05 is verified in Phase 3, when the rail gains actions, and must not regress after it).
- Demos, fixtures and e2e runs use a synthetic resume only, never a real person's.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Real AI path, end to end** - Paste a resume, "Check my fit" with quoted evidence and a code-computed score (completed 2026-10-11)
- [ ] **Phase 01.1: Gaps, learning plan, tips and failure handling** (INSERTED) - Gaps, a learning plan per gap, tailoring tips, clear AI failure messages, safe handling of corrupted saved data
- [ ] **Phase 01.2: Resume upload, review and lifecycle** (INSERTED) - PDF upload, two-step review, "I do have this", replace or delete, stale-result marker
- [ ] **Phase 2: Workspace, search and design system** - LinkedIn-style three-pane page, full search and filters, design system, fit score on result cards
- [ ] **Phase 3: Applications core** - Save and mark applied; stage shows on cards, in the detail pane and in the "My applications" rail
- [ ] **Phase 4: Stage editing and close-out** - Add, rename, remove and reorder stages; close with a reason, reopen, rail quick actions
- [ ] **Phase 5: Pipeline strip and nudges** - Pipeline counts that filter the rail, response rate, needs-attention nudges, tracking-status search filter
- [ ] **Phase 6: Ask about this job** - Streaming, stoppable, retryable chat grounded in the posting and resume
- [ ] **Phase 7: Your data: export, import, erase** - Export, import and erase all browser data, and recover from lost or corrupted storage

## Phase Details

### Phase 1: Real AI path, end to end

**Goal:** As a job seeker, I want to paste my resume and check my fit for a job, so that I see each job requirement rated against quoted evidence from my resume and an honest fit score.
**Mode:** mvp
**Demo:** Paste a synthetic resume, pick a seed job, click "Check my fit" and watch each requirement appear rated with its resume quote, plus the score and band labelled as an estimate; refresh and the result is still there with no new AI request.
**Depends on**: Nothing (first phase; the Vite starter and the empty `server/` package are scaffolded beforehand)
**Requirements**: RES-02, FIT-01, FIT-02, FIT-03, FIT-08, DATA-01, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. User can paste resume text, with email, phone, street address and links removed before it is saved or sent, and is told this happened
  2. User who clicks "Check my fit" on a seeded job gets, from a real AI model called by the server, every job requirement rated met, partial or not evidenced, with the supporting resume quote for met and partial ratings; a rating whose quote is not found in the resume is shown as not evidenced
  3. User sees an overall score and band (Strong fit / Good fit / Stretch / Long shot) computed in code from those ratings and labelled as an estimate
  4. User reopening an analysed job, including after a refresh, sees the previous analysis instantly with no new AI call; the pasted resume also survives a refresh
  5. User is told plainly that our server reads the resume without storing or logging it and that Google processes it; the AI key never appears in the browser; a failed or unconfigured AI call shows one clear, retryable message

**Plans:** 11/11 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Workspace package, pinned Gemini SDK (after a blocking registry check) and the approved configuration changes

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Tracer, server half: wire contracts, AI client over generateContent, POST /api/fit, stand-in model

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Tracer, browser half: stub page, stored analysis, refresh without a new AI request, Playwright harness
- [x] 01-04-PLAN.md — Contact details and links removed in shared code and enforced on the server before any model call

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-05-PLAN.md — Nine hand-written seed jobs, the synthetic demo resume, job list and job detail page
- [x] 01-06-PLAN.md — Server guards: metadata-only logs, origin check, hand-written rate limiter
- [x] 01-07-PLAN.md — Evidence-checked ratings: quote verification, id reconciliation, supported-keyword schema

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-08-PLAN.md — Paste form with contact removal shown to the user, persisted resume, greeting feature retired
- [x] 01-09-PLAN.md — Live-call spike against the real model (paid, not a gate) and model settings from the measurements

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-10-PLAN.md — Score and band computed in code, result panel, running and failed states
- [x] 01-11-PLAN.md — Privacy note with the billing decision, AI status notice, env template, no-key-in-browser test

**UI hint**: yes

### Phase 01.1: Gaps, learning plan, tips and failure handling (INSERTED)

**Goal:** As a job seeker, I want to see what is missing and what to learn next, and to recover cleanly when the AI or my saved data fails, so that every fit check leaves me with a next step.
**Mode:** mvp
**Demo:** Run a fit check and see gaps split into required and nice-to-have, each with a learning plan, plus tailoring tips; force an AI failure and recover with "Try again"; reload with corrupted saved data and see a notice above a working page.
**Depends on:** Phase 1
**Requirements**: FIT-04, FIT-06, FIT-07, FIT-11, DATA-02
**Success Criteria** (what must be TRUE):
  1. User sees their gaps separated into required and nice-to-have and worded "not evidenced in your resume"
  2. User sees a learning plan for each gap (what to learn, why it matters for this job, rough effort) with no links or named courses
  3. User sees resume tailoring tips that never suggest claiming something the resume does not support
  4. User sees progress while an analysis runs, and a distinct, retryable message for a failure, a timeout, a rate limit and an unconfigured AI service
  5. User whose saved data is corrupted or from an older version sees it migrated or set aside with a visible message, and the page still works

**Plans:** 8/9 plans executed

Plans:
**Wave 1**
- [x] 01.1-01-PLAN.md — Tracer, server half: one fit check answers with a learning plan per gap; advice parsed leniently so it never costs the ratings
- [x] 01.1-09-PLAN.md — The failure contract: error codes with their status and retry flag, one shared sentence table, the rule from a failure to its code

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01.1-02-PLAN.md — Tracer, browser half: Gaps section split required and nice-to-have, learning plans, the notice on results saved in Phase 1
- [x] 01.1-03-PLAN.md — Advice checks: no links, tip quotes verified against the resume, keywords filtered against the posting and the resume
- [x] 01.1-04-PLAN.md — Saved data: guarded storage, set-aside copies, migration runner, storage notice above a working page

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01.1-05-PLAN.md — Failures raised on the server: rate limit, timeout, overloaded, key, billing, declined, cut off and unusable each leave as their own code; stand-in scenarios for all of them
- [x] 01.1-06-PLAN.md — Tailoring section: tips with their resume quotes, missing-keyword chips, every empty state

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01.1-08-PLAN.md — Failure messages and progress in the browser: per-code sentences, Try again only when it helps, staged progress, the demo flow test

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01.1-07-PLAN.md — Optional live checks against the real model (paid, user decides at that moment, not a gate): one smoke call, short latency measurement

**UI hint**: yes

### Phase 01.2: Resume upload, review and lifecycle (INSERTED)

**Goal:** As a job seeker, I want to upload my resume as a PDF, review what was read and replace it later, so that fit checks use a profile I trust and tell me when they are out of date.
**Mode:** mvp
**Demo:** Upload a synthetic PDF resume, correct the extracted text, edit the parsed profile, check fit, mark a gap "I do have this" and watch the score update, then replace the resume and see the old result read "resume changed, re-check?".
**Depends on:** Phase 01.1
**Requirements**: RES-01, RES-03, RES-04, RES-05, RES-06, FIT-05, FIT-10
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF resume, review and edit the extracted text and then the structured profile (headline, years, skills, roles) before it is used
  2. User whose PDF cannot be read (scanned, protected, too large) gets a clear message and a paste-instead option, and nothing is sent to the AI without their explicit choice
  3. User who clicks "Check my fit" with no resume is asked for one at that moment, and can replace or delete the resume at any time
  4. User can mark a gap "I do have this"; the skill is added to their profile as confirmed by them and the score updates with no AI call
  5. User whose resume has changed sees earlier analyses marked "resume changed, re-check?" and can re-run them

**Plans**: TBD
**UI hint**: yes

### Phase 2: Workspace, search and design system

**Goal:** As a job seeker, I want to search and filter realistic job listings in a LinkedIn-style three-pane page, so that I can browse, read and analyse jobs without leaving the page or losing my place.
**Mode:** mvp
**Demo:** Search "react remote", apply two filters, load more, open a job with the keyboard, run "Check my fit" and see the score land on that job's card; refresh and Back/Forward restore the same view; narrow the window to tablet width and the rail becomes a drawer.
**Depends on**: Phase 01.2 (the complete AI path from Phases 1 to 01.2)
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-06, SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-07, SRCH-08, SRCH-09, JOB-01, FIT-09
**Success Criteria** (what must be TRUE):
  1. User sees a LinkedIn-style page shell (top navigation, palette, system fonts, own wordmark and no LinkedIn logo or name) where only Jobs is active and the other navigation items are visibly inert, with results, the selected job and a "My applications" rail side by side at desktop widths, each pane scrolling independently, in one consistent modern design
  2. User can search the seeded listings by keyword (title, company, skills), filter by location, workplace type, seniority, employment type and date posted, see the result count and active filters as removable chips, clear all filters at once, and sort by relevance or date posted
  3. User can load more results without losing the current selection, move through the results and open a job using only the keyboard, see which jobs they have already opened, and see clear empty, loading and error states for search
  4. User can open a job, read its full structured posting (role summary, responsibilities, requirements, nice-to-haves, company, location, salary when present), switch to the My fit view to run "Check my fit", and then see the fit score on that job's result card
  5. User who refreshes or uses browser Back/Forward gets the same search text, filters and selected job back, and at tablet widths the rail collapses into a drawer

**Plans**: TBD
**UI hint**: yes

### Phase 3: Applications core

**Goal:** As a job seeker, I want to save jobs and mark them applied and see their stage on the same page as my search, so that I can follow every application without losing my search context.
**Mode:** mvp
**Demo:** Save a job from search and watch its stage appear on the result card and as a row in the rail at the same moment; mark it applied, edit a stage, undo from the toast and refresh; the search list never moves.
**Depends on**: Phase 2
**Requirements**: TRK-01, TRK-02, TRK-03, TRK-04, TRK-05, TRK-06, TRK-07, TRK-09, STG-01, STG-02, JOB-02, JOB-03, WORK-05
**Success Criteria** (what must be TRUE):
  1. User can save a job and remove it from saved, mark a job as applied with an editable applied date (nothing is submitted anywhere), and follow "Apply on company site" and, on returning, be asked whether they applied, with "yes" starting tracking with today's date
  2. User sees every tracked job in the "My applications" rail grouped by pipeline phase with a compact progress indicator, sees the current stage on its search result card (for example "Technical interview · 3 of 6"), and sees the same status in the card, the detail pane and the rail at all times
  3. User who opens a tracked job from search or from the rail lands on its stage timeline (new applications start from Saved → Applied → Recruiter screen → Technical interview → Final round → Offer), can switch between Overview, My fit and Progress views without leaving the page, and can open a tracked job from the rail even when the current filters would hide it
  4. User can set each stage's status (upcoming, in progress, passed, failed, skipped), date and free notes, and can undo a quick action or destructive change from a toast shown right after it
  5. User keeps the search results, scroll position and selected job after any action in the detail pane or the rail, and all applications and stage edits survive a refresh

**Plans**: TBD
**UI hint**: yes

### Phase 4: Stage editing and close-out

**Goal:** As a job seeker, I want to shape each application's stages and close it with a reason, so that my tracker matches how each real hiring process went and keeps its history.
**Mode:** mvp
**Demo:** Build a custom pipeline for one job (add Take-home, rename a stage, Move up), mark a stage failed and accept "close as rejected", watch it leave the rail, then reopen it from the closed list with its history intact.
**Depends on**: Phase 3
**Requirements**: STG-03, STG-04, STG-05, TRK-08, TRK-10, TRK-11, TRK-12
**Success Criteria** (what must be TRUE):
  1. User can add any number of stages to an application, choosing from suggested common stages (Take-home, System design, HR call, Reference check and others) or typing a custom name, and can rename and remove stages; removing a stage that has notes asks for confirmation or can be undone
  2. User can reorder stages with Move up / Move down controls using only the keyboard, and the current stage and progress indicator on the card, detail pane and rail reflect the new order
  3. User can advance or close an application directly from the rail, and can close it from the detail pane, choosing a reason (rejected, withdrew, offer accepted, offer declined, no reply); it leaves the active list and keeps its history
  4. User can view closed applications and reopen one with its history intact
  5. User who marks a stage as failed is offered to close the application as rejected

**Plans**: TBD
**UI hint**: yes

### Phase 5: Pipeline strip and nudges

**Goal:** As a job seeker, I want to see a pipeline summary and get nudges on applications that need attention, so that I know where my search stands and nothing goes quiet unnoticed.
**Mode:** mvp
**Demo:** Click "Interviewing" in the strip and the rail filters to it; an old applied job shows a "gone quiet" nudge at the top of the rail and is snoozed; switch the search to hide jobs already applied to.
**Depends on**: Phase 4
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08, SRCH-06
**Success Criteria** (what must be TRUE):
  1. User sees a pipeline summary strip with counts for saved, applied, interviewing, offers and closed that always agree with the rail, and can click a count to filter the rail to that phase
  2. User sees their response rate once at least three applications have been sent, with an explanation of how it is calculated
  3. User sees a nudge on applications that have gone quiet (14 days after applying, 7 days after an interview stage, with no activity), on stages dated within the next 3 days, and on stages whose date has passed without a status update, with applications needing attention grouped at the top of the rail
  4. User can snooze a nudge for 7 days, after which it returns if still relevant
  5. User can filter search results by tracking status (all / not yet tracked / saved / applied), including hiding jobs already applied to

**Plans**: TBD
**UI hint**: yes

### Phase 6: Ask about this job

**Goal:** As a job seeker, I want to ask free-text questions about the open job and watch the answer stream in, so that I get answers grounded in the posting and my resume without leaving the page.
**Mode:** mvp
**Demo:** Ask "What would I do in my first week?", watch the answer stream in, stop it mid-answer, retry, then refresh and see the conversation still there.
**Depends on**: Phase 2 (detail pane) and Phase 1 (AI path); independent of Phases 3 to 5
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. User can ask free-text questions about the open job and get answers grounded in the job posting and their resume; a user without a resume is asked for one at that moment, using the same flow as "Check my fit"
  2. User sees the answer stream in as it is generated and can stop it
  3. User can start from suggested question chips
  4. User's conversation for each job (most recent messages) is still there after a refresh
  5. User can retry an answer that failed or was interrupted

**Plans**: TBD
**UI hint**: yes

### Phase 7: Your data: export, import, erase

**Goal:** As a job seeker, I want to export, import and erase all my data, so that I keep control of my browser-only records and can recover them if the browser loses them.
**Mode:** mvp
**Demo:** Export data to a file, erase everything and watch the page return to first-run, import the file and see applications, analyses and chats come back; reload with corrupted storage and recover the same way.
**Depends on**: Phase 6 (all persisted data exists by then)
**Requirements**: DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. User can export all their data (resume, applications and stages, analyses, chat history) to a file from a clear "Your data" control
  2. User can erase all their data, including the resume, after a confirmation, and the page returns to a clean first-run state
  3. User can import a previously exported file and sees applications, rail, card badges, analyses and chat threads restored exactly; an invalid or unreadable file shows a clear message and leaves existing data untouched
  4. User whose browser storage was found corrupted and set aside can import their last export and get back to their data

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → 2 → 3 → 4 → 5 → 6 → 7 (Phase 6 does not depend on Phases 3 to 5 and may be swapped ahead of them if streaming risk needs retiring sooner)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Real AI path, end to end | 11/11 | Complete    | 2026-10-11 |
| 01.1. Gaps, learning plan, tips and failure handling | 8/9 | In Progress | - |
| 01.2. Resume upload, review and lifecycle | 0/TBD | Not started | - |
| 2. Workspace, search and design system | 0/TBD | Not started | - |
| 3. Applications core | 0/TBD | Not started | - |
| 4. Stage editing and close-out | 0/TBD | Not started | - |
| 5. Pipeline strip and nudges | 0/TBD | Not started | - |
| 6. Ask about this job | 0/TBD | Not started | - |
| 7. Your data: export, import, erase | 0/TBD | Not started | - |
