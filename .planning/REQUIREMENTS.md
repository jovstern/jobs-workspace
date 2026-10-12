# Requirements: Jobs Workspace

**Defined:** 2026-10-10
**Core Value:** The user can search for jobs and see and update the progress of every application on the same page, without ever losing their search context.

## v1 Requirements

Requirements for the first usable version. Each maps to exactly one roadmap phase.

### Workspace and Design

- [ ] **WORK-01**: User sees a LinkedIn-like page shell (top navigation, palette, system fonts) in which only Jobs is active and the other navigation items are visibly inert
- [ ] **WORK-02**: User sees results, the selected job and "My applications" side by side in one three-pane page at desktop widths, each pane scrolling independently
- [ ] **WORK-03**: User can use the page at tablet widths, where the applications rail collapses into a drawer
- [ ] **WORK-04**: User's search text, filters, selected job and rail filter are held in the page address, so refresh and browser Back/Forward restore the same view
- [ ] **WORK-05**: User keeps their search results, scroll position and selected job after any action in the detail pane or the rail
- [ ] **WORK-06**: User sees a modern, consistent visual design across the whole jobs page (shared design tokens and components), distinct from LinkedIn's current jobs UI and without LinkedIn's logo or name

### Search

- [ ] **SRCH-01**: User can search seeded job listings by keyword (title, company, skills)
- [ ] **SRCH-02**: User can filter results by location, workplace type (remote / hybrid / on-site), seniority, employment type and date posted
- [ ] **SRCH-03**: User sees the result count and the active filters as removable chips, and can clear all filters at once
- [ ] **SRCH-04**: User can sort results by relevance or date posted
- [ ] **SRCH-05**: User can load more results without losing the current selection
- [ ] **SRCH-06**: User can filter results by tracking status (all / not yet tracked / saved / applied), including hiding jobs already applied to
- [ ] **SRCH-07**: User sees which jobs they have already opened (viewed state)
- [ ] **SRCH-08**: User can move through results and open a job using only the keyboard
- [ ] **SRCH-09**: User sees clear empty, loading and error states for search

### Job Detail

- [ ] **JOB-01**: User can open a job and read its full structured posting (role summary, responsibilities, requirements, nice-to-haves, company, location, salary when present)
- [ ] **JOB-02**: User can switch between Overview, My fit and Progress views of the selected job without leaving the page
- [ ] **JOB-03**: User can follow "Apply on company site" and, on returning, is asked whether they applied; answering yes starts tracking with today's date

### Application Tracking

- [ ] **TRK-01**: User can save a job and remove it from saved
- [ ] **TRK-02**: User can mark a job as applied with an editable applied date; no application is submitted anywhere
- [ ] **TRK-03**: User sees every tracked job in the "My applications" rail, grouped by pipeline phase, each with a compact progress indicator
- [ ] **TRK-04**: User sees the current stage of a tracked job on its search result card (for example "Technical interview · 3 of 6")
- [ ] **TRK-05**: User who opens a tracked job from search or from the rail sees its stage timeline, not a blank untracked state
- [ ] **TRK-06**: User sees the same status for a job in the result card, the detail pane and the rail at all times
- [ ] **TRK-07**: User can open a tracked job from the rail even when the current search filters would hide it
- [ ] **TRK-08**: User can advance or close an application directly from the rail
- [ ] **TRK-09**: User can undo a quick action or a destructive change from a toast shown right after it
- [ ] **TRK-10**: User can close an application with a reason (rejected, withdrew, offer accepted, offer declined, no reply); it leaves the active list and keeps its history
- [ ] **TRK-11**: User can view closed applications and reopen one with its history intact
- [ ] **TRK-12**: User who marks a stage as failed is offered to close the application as rejected

### Stages

- [ ] **STG-01**: User's new application starts from the default template: Saved → Applied → Recruiter screen → Technical interview → Final round → Offer
- [ ] **STG-02**: User can set each stage's status (upcoming, in progress, passed, failed, skipped), date and free notes
- [ ] **STG-03**: User can add any number of stages, choosing from suggested common stages (Take-home, System design, HR call, Reference check and others) or typing a custom name
- [ ] **STG-04**: User can rename and remove stages; removing a stage that has notes asks for confirmation or can be undone
- [ ] **STG-05**: User can reorder stages with Move up / Move down controls that work by keyboard

### Pipeline and Nudges

- [ ] **PIPE-01**: User sees a pipeline summary strip with counts for saved, applied, interviewing, offers and closed
- [ ] **PIPE-02**: User can click a count in the strip to filter the applications rail to that phase
- [ ] **PIPE-03**: User sees their response rate once at least three applications have been sent, with an explanation of how it is calculated
- [ ] **PIPE-04**: User sees a nudge on applications that have gone quiet (14 days after applying, 7 days after an interview stage, with no activity)
- [ ] **PIPE-05**: User sees a nudge for stages dated within the next 3 days
- [ ] **PIPE-06**: User sees a nudge for stages whose date has passed without a status update
- [ ] **PIPE-07**: User can snooze a nudge for 7 days
- [ ] **PIPE-08**: User sees applications that need attention grouped at the top of the rail

### Resume

- [ ] **RES-01**: User can provide a resume by uploading a PDF
- [x] **RES-02**: User can provide a resume by pasting text
- [ ] **RES-03**: User can review and edit the extracted resume content and the structured profile (skills, roles, experience) before it is used
- [ ] **RES-04**: User can replace or delete their resume at any time
- [ ] **RES-05**: User is asked for a resume at the moment they first need it (checking fit or chatting), not as a wall before using the page
- [ ] **RES-06**: User gets a clear message and a paste-instead option when a PDF cannot be read (scanned, protected, too large)

### Fit Analysis

- [x] **FIT-01**: User can run "Check my fit" on the open job and get an analysis from a real AI model comparing the job with their resume
- [x] **FIT-02**: User sees each job requirement rated met, partial or not evidenced, with the supporting quote from their resume for met and partial ratings
- [x] **FIT-03**: User sees an overall fit score and band computed from those ratings, labelled as an estimate
- [ ] **FIT-04**: User sees their gaps separated into required and nice-to-have, worded as "not evidenced in your resume"
- [ ] **FIT-05**: User can mark a gap as "I do have this", which updates the result
- [x] **FIT-06**: User sees a learning plan for each gap (what to learn, why it matters for this job, rough effort)
- [ ] **FIT-07**: User sees resume tailoring tips for the job (which existing experience to emphasise, which posting keywords their resume lacks) that never suggest claiming something the resume does not support
- [x] **FIT-08**: User sees a previous analysis instantly when reopening a job, without another AI call
- [ ] **FIT-09**: User sees the fit score on the result card of any job they have analysed
- [ ] **FIT-10**: User whose resume has changed sees earlier analyses marked "resume changed, re-check?" and can re-run them
- [ ] **FIT-11**: User sees progress while an analysis runs and a clear, retryable message when it fails, times out or the AI service is not configured

### Job Chat

- [ ] **CHAT-01**: User can ask free-text questions about the open job and get answers grounded in the job posting and their resume
- [ ] **CHAT-02**: User sees the answer stream in as it is generated and can stop it
- [ ] **CHAT-03**: User can start from suggested question chips
- [ ] **CHAT-04**: User's conversation for each job is kept across refresh (most recent messages)
- [ ] **CHAT-05**: User can retry a failed or interrupted answer

### Data and Privacy

- [x] **DATA-01**: User's resume, applications, stages, analyses and chat history persist in the browser across refresh and restart
- [ ] **DATA-02**: User's saved data survives app updates (versioned storage with migration), and corrupted storage is set aside with a visible message instead of crashing the page
- [ ] **DATA-03**: User can export all their data to a file
- [ ] **DATA-04**: User can import a previously exported file to restore their data
- [ ] **DATA-05**: User can erase all their data, including the resume
- [x] **DATA-06**: User's resume is sent to the server only to read its text and to run AI requests, is never stored or logged there, and the page says plainly that the server reads it and that the AI provider processes it
- [x] **DATA-07**: User's AI requests are made by the server; the AI API key is never present in the browser

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Jobs

- **FEED-01**: User sees real job listings from a live feed
- **FEED-02**: User can add an application for a job found elsewhere ("Add external application")

### Accounts

- **ACCT-01**: User can sign up and log in
- **ACCT-02**: User's data syncs across devices

### AI

- **PREP-01**: User gets interview preparation for an upcoming stage (likely questions, topics to revise)
- **FIT-12**: User sees automatic fit scores on every search result and can sort by best fit
- **FIT-13**: User sees a fit score breakdown by dimension

### Tracking

- **STG-06**: User can reorder stages by drag and drop
- **STG-07**: User can record who they met at each stage
- **NOTF-01**: User receives email or push reminders

### Platform

- **MOBL-01**: User can use the page on a phone
- **THEM-01**: User can switch to a dark theme

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Scraping or mirroring LinkedIn listings | No public API; scraping breaks their terms |
| Submitting applications / simulated Easy Apply | People apply on the employer's site; we record it |
| Kanban board as the main tracking view | Clashes with the three-pane workspace |
| Resume builder, rewriter or cover-letter generator | A different product; tailoring tips are advisory only |
| ATS formatting checks | Not the problem being solved |
| Browser extension or form autofill | Outside a single web page |
| Contacts / recruiter CRM | Scope creep beyond job tracking |
| Fit score as an apply / don't-apply verdict | The score is an estimate to inform, not decide |
| AI suggesting skills or keywords the resume does not support | Dishonest and harmful to the user |
| Links or named courses in learning plans | Models invent links |
| Other LinkedIn pages (Home, Network, Messaging, Profile) | Only the jobs page is being rebuilt |
| LinkedIn logo, name or trademarked assets | Trademark; the look is evoked, not copied |
| Languages other than English, right-to-left layout | Not needed for the first version |

## Traceability

Which phases cover which requirements. Filled in during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | Phase 2 | Pending |
| WORK-02 | Phase 2 | Pending |
| WORK-03 | Phase 2 | Pending |
| WORK-04 | Phase 2 | Pending |
| WORK-05 | Phase 3 | Pending |
| WORK-06 | Phase 2 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| SRCH-04 | Phase 2 | Pending |
| SRCH-05 | Phase 2 | Pending |
| SRCH-06 | Phase 5 | Pending |
| SRCH-07 | Phase 2 | Pending |
| SRCH-08 | Phase 2 | Pending |
| SRCH-09 | Phase 2 | Pending |
| JOB-01 | Phase 2 | Pending |
| JOB-02 | Phase 3 | Pending |
| JOB-03 | Phase 3 | Pending |
| TRK-01 | Phase 3 | Pending |
| TRK-02 | Phase 3 | Pending |
| TRK-03 | Phase 3 | Pending |
| TRK-04 | Phase 3 | Pending |
| TRK-05 | Phase 3 | Pending |
| TRK-06 | Phase 3 | Pending |
| TRK-07 | Phase 3 | Pending |
| TRK-08 | Phase 4 | Pending |
| TRK-09 | Phase 3 | Pending |
| TRK-10 | Phase 4 | Pending |
| TRK-11 | Phase 4 | Pending |
| TRK-12 | Phase 4 | Pending |
| STG-01 | Phase 3 | Pending |
| STG-02 | Phase 3 | Pending |
| STG-03 | Phase 4 | Pending |
| STG-04 | Phase 4 | Pending |
| STG-05 | Phase 4 | Pending |
| PIPE-01 | Phase 5 | Pending |
| PIPE-02 | Phase 5 | Pending |
| PIPE-03 | Phase 5 | Pending |
| PIPE-04 | Phase 5 | Pending |
| PIPE-05 | Phase 5 | Pending |
| PIPE-06 | Phase 5 | Pending |
| PIPE-07 | Phase 5 | Pending |
| PIPE-08 | Phase 5 | Pending |
| RES-01 | Phase 01.2 | Pending |
| RES-02 | Phase 1 | Complete |
| RES-03 | Phase 01.2 | Pending |
| RES-04 | Phase 01.2 | Pending |
| RES-05 | Phase 01.2 | Pending |
| RES-06 | Phase 01.2 | Pending |
| FIT-01 | Phase 1 | Complete |
| FIT-02 | Phase 1 | Complete |
| FIT-03 | Phase 1 | Complete |
| FIT-04 | Phase 01.1 | Pending |
| FIT-05 | Phase 01.2 | Pending |
| FIT-06 | Phase 01.1 | Complete |
| FIT-07 | Phase 01.1 | Pending |
| FIT-08 | Phase 1 | Complete |
| FIT-09 | Phase 2 | Pending |
| FIT-10 | Phase 01.2 | Pending |
| FIT-11 | Phase 01.1 | Pending |
| CHAT-01 | Phase 6 | Pending |
| CHAT-02 | Phase 6 | Pending |
| CHAT-03 | Phase 6 | Pending |
| CHAT-04 | Phase 6 | Pending |
| CHAT-05 | Phase 6 | Pending |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 01.1 | Pending |
| DATA-03 | Phase 7 | Pending |
| DATA-04 | Phase 7 | Pending |
| DATA-05 | Phase 7 | Pending |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 72 total
- Mapped to phases: 72
- Unmapped: 0 ✓

**Per phase:** Phase 1: 8, Phase 01.1: 5, Phase 01.2: 7, Phase 2: 15, Phase 3: 13, Phase 4: 7, Phase 5: 9, Phase 6: 5, Phase 7: 3

---
*Requirements defined: 2026-10-10*
*Last updated: 2026-10-10 after roadmap creation (traceability filled)*
