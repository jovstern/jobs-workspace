# Feature Research

**Domain:** Job search page with built-in application tracking and AI resume-to-job fit analysis (single user, browser-persisted, seeded listings)
**Researched:** 2026-10-10
**Confidence:** MEDIUM-HIGH. Table stakes for search and tracking are stable, widely repeated conventions (HIGH). Competitor specifics (Huntr, Teal, Jobscan, LinkedIn Job Tracker) were spot-checked with web search and otherwise rest on product knowledge (MEDIUM). Concrete thresholds (nudge days, score bands) are recommendations, not industry standards (LOW-MEDIUM; flagged as decisions).

**How to read this:** PROJECT.md scope is treated as decided. Every item below is tagged **[IN]** (already in PROJECT.md Active, confirmed or sharpened), **[ADD]** (missing table stake or small gap, recommended for v1), or **[OUT]** (respects Out of Scope or a new anti-feature). Nothing tagged [ADD] needs a new phase. Each is a small addition to an existing one.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these and a user who has used LinkedIn, Indeed or Huntr will feel the page is broken or toy-like.

#### A. Job search (results list)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Keyword box (title, company, skill) plus location box | Every job board has the two-field search (LinkedIn, Indeed, Wellfound). | LOW | [IN] Server-side match over title, company, skills, description. Debounce; submit on Enter. |
| Filters: Date posted, Work mode (Remote/Hybrid/On-site), Experience level, Job type (Full-time/Contract/...), Salary range | Core LinkedIn filter set. Work mode and date posted are the most used. | MEDIUM | [IN] Keep to these five; Easy Apply, Under 10 applicants, In my network, Has verification are all LinkedIn-only and do not apply. Seed data must have enough spread that each filter changes results. |
| Active-filter chips, result count, one-click "Clear all" | Users lose track of which filters are on; LinkedIn and Indeed both show chips and counts. | LOW | [ADD] Cheap and prevents the "why is the list empty?" problem. |
| Sort: Most relevant / Most recent | LinkedIn and Indeed both offer it. | LOW | [IN] Two options only. |
| Result card: logo (or initials fallback), title, company, location + work mode, posted-ago, salary if present | Minimum scannable card in every product. | LOW | [IN] Use generated initials avatars, not real logos (trademark and asset concerns). |
| Card shows tracked state: Saved bookmark filled, stage pill ("Applied", "Technical interview") | Core Value; also what LinkedIn does ("Applied 2d ago" on card). | MEDIUM | [IN] The hard part is single source of truth with the rail, not the UI. |
| Card shows viewed state (muted title once opened) | LinkedIn and Indeed both do it; helps scanning long lists. | LOW | [ADD] A boolean per job id in the persisted store. |
| Selected-card highlight, keyboard Up/Down to move through results | Two-pane master/detail convention (LinkedIn, Otta). | LOW | [ADD] Accessibility and speed. Radix primitives help. |
| Save (bookmark) toggle directly on the card and in detail | LinkedIn, Indeed, Wellfound all have one-click save in-list. | LOW | [IN] |
| Empty, loading and error states for the list | Table stakes for any async list. | LOW | [ADD] Empty state should suggest clearing filters. |
| Pagination or incremental load | Lists beyond about 25 items need it. | LOW | [ADD] "Load more" is simplest and keeps selection stable. |
| Search state survives selecting jobs and acting on applications | Core Value: "without ever losing their search context". | MEDIUM | [IN] Query, filters, sort, scroll position and selected job id live in one store, ideally mirrored in URL search params so refresh restores it. |

#### B. Job detail (selected job pane)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Header: title, company, location, work mode, type, salary, posted date | Universal. | LOW | [IN] |
| Full description with real structure: About the role, Responsibilities, Requirements, Nice to have, Benefits | Users scan for requirements; the AI fit analysis also depends on it. | LOW (UI), MEDIUM (writing realistic seed data) | [IN] Seed descriptions must be long and realistic. Thin descriptions make fit analysis look fake. |
| Skills/requirements chips | LinkedIn "skills match", Wellfound and Otta all show them. | LOW | [ADD] Store as structured `skills[]` on the seed job; also useful for keyword search. |
| Primary action: "Apply on company site" (opens external URL), then Save | The product tracks but does not submit (Out of Scope: no Easy Apply). Apply is still the primary action in every job UI. | LOW | [IN, sharpened] See next row. |
| "Did you apply?" confirm after returning from the external apply link | LinkedIn and Indeed both prompt this on return. It is the natural entry point to "Mark as applied". | LOW | [ADD] On window focus after outbound click, show an inline banner: "Did you apply? [Yes, mark applied] [Not yet]". Avoids relying on the user remembering. |
| "Mark as applied" with editable applied date | Users log applications later or from other devices; date must be backdate-able. | LOW | [IN, sharpened] Default today, editable. Response-rate and "gone quiet" depend on this date being right. |
| Tracking panel for tracked jobs, pinned at top of the detail pane (timeline, current stage, close action) | Core Value requirement: tracked card "opens to its stage timeline". | MEDIUM | [IN] Collapsible card above the description, not a separate tab, so the description stays visible. |

#### C. Application tracking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Default pipeline: Saved → Applied → Recruiter screen → Technical interview → Final round → Offer | Every tracker's default is a variant: Huntr Wishlist/Applied/Interview/Offer; Teal Saved/Applied/Interview/Offer/Rejected; LinkedIn Saved/Applied/Interviewing/Archived. Ours is more granular, which fits the "track a specific application" pain. | LOW | [IN] Confirmed. |
| Editable stages: add, rename, remove, reorder, from suggestions or free text | Huntr and Teal both let users customise columns; real hiring processes vary (take-home, HR call, panel). | MEDIUM | [IN] Suggested list: Take-home, System design, HR call, Hiring manager, Reference check, Background check, Onsite, Negotiation. Reorder needs a keyboard alternative to drag (move up/down buttons). |
| Per-stage record: status, date, notes | Core of any tracker. | MEDIUM | [IN] Statuses: upcoming, in progress, passed, failed, skipped. |
| Per-stage optional "with whom" (interviewer or contact name) | Users always note who they spoke to; Huntr and Teal have contacts. | LOW | [ADD, optional] One extra text field on the stage, no contacts CRM. Can be deferred to a notes convention if scope pressure. |
| Application-level snapshot of job info (title, company, URL, salary, location) | Application must survive even if the job disappears from the seeded list or a re-seed changes ids. | LOW | [ADD] Store a copy on the application at save time. |
| Application-level notes | Huntr and Teal both have a notes field per job, separate from stage notes. | LOW | [ADD] One free-text field. |
| Close with a reason: rejected, withdrew, offer accepted, offer declined, no reply | Trackers all have a terminal state; LinkedIn "Archived", Teal "Rejected". | LOW | [IN] Confirmed. Also store close date and optional note. |
| Reopen a closed application | Mistakes happen (closed by accident; rejected, then re-engaged). | LOW | [ADD] Cheap, prevents data-loss complaints. |
| Closed applications leave the active list but remain findable with history | PROJECT.md decision. | LOW | [IN] Reached by clicking "Closed" in the pipeline strip. |
| Quick actions in the rail: advance to next stage, close, open | LinkedIn "change stage" is a one-click action; tracker UX is dominated by fast updates. | LOW | [ADD] "Advance" = mark current stage passed, set next stage in progress with today's date. |
| Undo or confirm for destructive actions (remove stage, close, unsave, delete) | Users lose notes by accident otherwise. | LOW | [ADD] Toast with Undo is better than a confirm dialog. |
| Persistence across refresh | Constraint. | MEDIUM | [IN] Version the persisted schema from day one (see Pitfalls); migrations are painful later. |
| Export/import data as JSON, and "clear all data" | Browser-only storage means clearing site data wipes a month of job-search history; Huntr and Teal are cloud-backed so users do not face this. | LOW | [ADD, P2] Small, protects trust. Also doubles as the privacy "delete my data" control for resume and analyses. |

#### D. Summary metrics and nudges

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pipeline strip: Saved / Applied / Interviewing / Offers / Closed counts, click to filter the rail | Teal and Huntr dashboards show counts per stage; ours doubles as a filter. | MEDIUM | [IN] **Buckets must be mutually exclusive and derived**, not stored. Suggested derivation (decision needed in requirements): Closed = closed flag; else Offers = Offer stage in progress/passed; else Interviewing = any stage after Applied in progress/passed; else Applied = Applied passed; else Saved. |
| Response rate | Standard job-search health metric. | LOW | [IN] **Define it explicitly and show a tooltip.** Recommended: applications that moved beyond Applied (any stage after Applied in progress/passed, or closed as rejected after a reply) divided by all applications ever marked applied, closed ones included. Hide until at least about 3 applied, to avoid "0%" or "100%" noise. |
| Gone-quiet nudge | Teal prompts a follow-up about one week after no reply; this is the single most valued tracker reminder. | MEDIUM | [IN] Recommended defaults: Applied with no stage movement for 14 days; in an interview stage with no update for 7 days. Surface as a badge on the rail item plus a "Needs attention" group at the top of the rail. Also suggest "Close as no reply" after about 30 days. Thresholds are constants in one config file. |
| Upcoming-stage nudge | Interview dates are the most time-sensitive thing in the tracker. | LOW | [IN] Stages with status upcoming or in progress dated within the next 3 days (include today). |
| Overdue-stage nudge: dated stage whose date has passed but status was never updated | Common real-world gap: users forget to update after an interview. | LOW | [ADD] Same mechanism as upcoming-stage; high value for little cost. |
| Dismiss or snooze a nudge | Un-dismissable nudges become noise and get ignored. | LOW | [ADD] Per-application "snooze 7 days"; store `snoozedUntil`. |

#### E. Resume and AI fit analysis

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Resume intake: PDF upload or pasted text | Every resume-fit tool (Jobscan, Teal, Rezi) does both. | MEDIUM | [IN] Paste fallback is essential: scanned PDFs have no text layer. File size cap and clear error state. |
| Show the parsed profile for review and correction | Parsing errors silently poison every fit score; Jobscan and Teal let users edit. | MEDIUM | [ADD] Editable structured profile (summary, skills, roles, education). Without it, wrong scores are undiagnosable. |
| Just-in-time resume prompt (on first "Check my fit"), not an onboarding wall | PROJECT.md says nothing blocks the page being visible. | LOW | [ADD] Search and tracking work with zero resume. |
| Replace and delete resume | Privacy expectation for sensitive data. | LOW | [ADD] Deleting the resume should mark cached analyses stale or clear them. |
| On-demand "Check my fit" with loading state, error and retry | Constraint: analysis only on demand. | MEDIUM | [IN] Show progress copy; handle API failures and timeouts. |
| Fit score as a single number, with a plain-language verdict | Jobscan "match rate", Teal "Match Score", Rezi score; users expect one headline number. | LOW | [IN] Show 0 to 100 plus band label (for example Strong 80+, Good 65 to 79, Stretch 50 to 64, Weak below 50). Always labelled an estimate. |
| Matched strengths | Jobscan lists matched hard and soft skills; this is the "why" behind the score. | LOW | [IN] |
| Gaps (missing skills or experience), split into required vs nice-to-have | Jobscan lists missing keywords but does not distinguish importance, which makes gaps feel arbitrary. | LOW | [IN, sharpened] Severity split is nearly free in the prompt schema. |
| Cached analysis per job, shown on the result card as a fit badge | PROJECT.md requirement. | MEDIUM | [IN] Cache key = job id + resume content hash. When the resume changes, show "Resume changed since this check. Re-check?" rather than silently showing a stale score. |
| Timestamp and "Re-run" on an analysis | Users need to know whether a score reflects the current resume. | LOW | [ADD] |

---

### Differentiators (Competitive Advantage)

Competing on everything dilutes the product. The Core Value points to **one** differentiating idea: *search, tracking and fit in one page that never loses context*. Everything below supports that.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Search results that know your pipeline (stage pill on card, opens to timeline) | No competitor combines these: LinkedIn's tracker is a separate page; Huntr and Teal are separate apps; Indeed's "My Jobs" is a separate view. This is the headline feature. | MEDIUM | [IN] Plus a tracked-status filter in search: Show **All / Not yet tracked / Saved / Applied** (and "hide jobs I've already applied to"). Cheap once state is shared and no competitor-style search does it well. [ADD, LOW] |
| Rich stage timeline per application (user-defined stages with status, date, notes) | LinkedIn gives four coarse states; Huntr and Teal give column positions, not a history. Users complain that statuses do not show the progress of one application. | MEDIUM | [IN] The visual design of the timeline is where the "modern, sleek" mandate pays off. |
| Rail items that show progress at a glance (mini stepper, current stage, days since last activity) | Turns the rail into a dashboard, not a list. | LOW-MEDIUM | [ADD] Small dots-with-current-stage component, reusable on cards. |
| Fit analysis grounded in the resume: each matched strength cites the resume evidence, each gap cites the job requirement | Jobscan and Teal score by keyword overlap and cannot explain their number; evidence makes the score credible and checkable. | MEDIUM | [IN, sharpened] Structured output: `{ text, evidence }`. Prompt rule: never invent resume content. |
| Score breakdown by dimension (skills, experience level, domain, seniority) | "Why 72?" is the first question; sub-scores answer it and make a noisy LLM number more stable. | MEDIUM | [ADD, optional] Four to five sub-scores that the overall score is derived from. Consider computing the headline in code from the sub-scores for consistency. |
| Learning plan per gap: what to learn, why it matters for this job, rough effort ("about 2 weeks") | Teal and Jobscan stop at "add this keyword"; none turn gaps into a plan. This delivers the "what they need to learn" half of the product promise. | MEDIUM | [IN] **No URLs or named courses**: models hallucinate links. Give topic, rough effort, a suggested project or exercise. |
| Resume tailoring tips per job: what to emphasise, what to reword, missing keywords to add *only where truthful* | Jobscan, Teal and Rezi all do keyword suggestions; the differentiator is the honesty guard ("you mention Kafka in role X, surface it") instead of keyword stuffing. | MEDIUM | [IN] Output a short list of concrete edits, ordered by impact. |
| Ask-about-this-job chat, grounded in the job, the profile and the existing fit analysis | Nobody ships this at the job-card level. Good for: decoding jargon in requirements, "how do I position my gap in X?", drafting questions for the recruiter, summarising responsibilities, salary or negotiation framing. | MEDIUM | [IN] Suggested-prompt chips (without them an empty chat box is a cold start), streaming responses, per-job thread persisted in the browser, "Clear chat". Stay on the job; no web access. |
| Needs-attention group in the rail with in-place follow-up actions | Teal sends reminders; this makes them visible exactly where the user is working. | LOW-MEDIUM | [IN] |
| Pipeline strip as a filter, not just a report | Teal and Huntr dashboards are read-only. | LOW | [IN] |
| Average days-to-first-response, interview rate, offer rate in the strip tooltip | Extra insight beyond response rate, cheap once dates are stored. | LOW | [ADD, P3] Nice to have. Do not add more tiles to the strip itself. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real LinkedIn feed or scraping | "Real jobs" is exciting. | Terms-of-service violation, no public API, brittle. **[OUT]** | Seeded realistic data behind a server API that a feed can replace later. |
| Easy Apply form / submitting applications | Looks like LinkedIn. | Fake form with nothing behind it; **[OUT]**. | "Apply on company site" + "Did you apply?" prompt. |
| Auto fit scores on every result | "Recommended for you" feel. | Cost, latency, and a wall of unreliable numbers; **[OUT]**. | On-demand check; score appears on the card afterward. A free local "skill overlap" hint could come later (v2), but do not build now. |
| Kanban board as the main tracker view | Huntr and Teal's signature view. | Needs horizontal space; clashes with three-pane layout; poor at showing one application's history. | Vertical rail plus timeline; pipeline strip gives the counts. |
| Email/push reminders, calendar sync, Gmail status auto-detection (Simplify) | Seen on Teal, Simplify. | **[OUT]**: needs accounts and infrastructure. | On-page nudges only. |
| Resume builder / rewriter / cover letter generator | Teal and Rezi core product. | Different product; scope and quality burden; **not in PROJECT.md** and would swamp the page. | Tailoring *tips* only. |
| ATS formatting checks and 30-parameter resume scoring (Jobscan, Rezi) | Looks authoritative. | Needs rule engines and layout parsing; outside "fit to this job". | Fit analysis only. |
| Browser extension / autofill / one-click save from other sites (Huntr, Teal, Simplify) | The main way those trackers capture jobs. | Separate deliverable; breaks single-page premise. | Seeded jobs only; optional "Add external application" (see Open Decisions). |
| Contacts CRM, company tracker, networking tools (Huntr, Teal) | Feature parity. | Scope creep; low value for this page. | Optional stage "with whom" field and free notes. |
| Saved searches / job alerts | LinkedIn has them. | Alerts need email/push (**[OUT]**); saved searches without alerts feel hollow. | "Recent searches" at most, and only as v1.x. |
| Interview prep per stage | Natural neighbour of stages. | **[OUT]**, deferred to a later milestone. | Chat can answer ad-hoc interview questions about a specific job. |
| Accounts, sync, social features, messaging | "Real product" feel. | **[OUT]** for v1. | Export/import JSON. |
| Fit score as a hard "apply / don't apply" verdict | Simple decision aid. | LLM scores are noisy; users over-trust a number and skip jobs they would have enjoyed. | Show band labels, evidence and "estimate" wording. |
| Fabricated keyword suggestions ("add Kubernetes") | Raises the Jobscan-style match number. | Encourages misrepresenting a resume; erodes trust. | Suggest only keywords the resume already supports or label them as gaps to learn. |
| Dark theme, i18n, RTL, mobile layout | Common asks. | **[OUT]** per PROJECT.md. | Plan tokens so they can be added later (CSS variables) but do not build. |

---

## Feature Dependencies

```
Seeded jobs API (with structured skills, long descriptions)
    ├──requires──> Search + filters + sort + result cards
    │                  └──requires──> Selected-job detail pane
    │                                     └──requires──> Save / Mark applied
    └──requires──> AI fit analysis (needs realistic descriptions)

Application store (single source of truth, versioned persistence)
    ├──requires──> Save / Mark applied
    │                  ├──enhances──> Stage badge on result card
    │                  ├──enhances──> "My applications" rail
    │                  └──requires──> Stage timeline (template, edit, status/date/notes)
    │                                     ├──requires──> Close-out with reason (+ reopen)
    │                                     ├──requires──> Pipeline strip (derived buckets) ──enhances──> Rail filter
    │                                     └──requires──> Nudges (dates + last-activity timestamps)
    └──requires──> Search/selection state in one store (so rail click never resets search)

Resume intake (PDF/paste) ──requires──> AI profile parsing ──requires──> Server AI proxy (key on server)
    └──requires──> Check my fit ──requires──> Fit analysis cache (job id + resume hash)
                       ├──enhances──> Fit badge on result card
                       ├──requires──> Learning plan (per gap)
                       ├──requires──> Tailoring tips
                       └──enhances──> Job chat (chat gets profile + fit as context)

"Did you apply?" prompt ──enhances──> Mark as applied
Tracked-status search filter ──requires──> Application store + search filters
Export/import JSON ──requires──> Versioned persistence schema
```

### Dependency Notes

- **Stage badge on card requires the shared application store:** the card, rail and timeline must read from the same Zustand store keyed by job id. Any duplicated state breaks the "must never disagree" rule.
- **Pipeline strip requires derived buckets:** compute counts from application data with one pure function, unit tested. Do not store a "status" field that can drift from the stages.
- **Nudges require last-activity timestamps:** record `lastActivityAt` on every change (stage status, date, note, applied). Do this from the first tracking phase, since back-filling later is impossible.
- **Fit analysis requires a parsed profile and realistic seed descriptions:** both are upstream of the highest-risk feature; seed quality gates how convincing the demo is.
- **Fit cache requires a resume hash:** otherwise a replaced resume leaves stale scores on cards.
- **Learning plan, tailoring tips and fit are one AI call:** structure one validated JSON (Zod) response rather than three calls; cheaper, consistent, and one loading state.
- **Chat enhances fit but does not require it:** works with just job plus profile; includes the analysis in context when present.
- **Close-out interacts with stage statuses:** closing as rejected should mark the in-progress stage failed; offer accepted should mark Offer passed; failing a stage should prompt "Close this application?". Define these rules once to avoid contradictory data.
- **Search/tracking cross-filter conflicts with pagination only if state is split:** keep tracked flags on cards derived at render time from the store, not baked into server responses (server is stateless anyway).

---

## UX Patterns: Combining Search and Tracking in One Three-Pane Page

Confirmed as the right approach; sharpened below.

1. **Left to right = broad to specific to personal.** Results list (about 360 to 400 px) → selected job (flexible) → "My applications" rail (about 300 to 340 px). Two scroll containers independent, header with search and filters fixed.
2. **Selection is a single id** shared by all three panes. Clicking a card, a rail item or a keyboard shortcut sets `selectedJobId`. Highlight it everywhere it appears.
3. **Rail click never resets search.** If the selected job is not in the current results (filtered out), still show it in the detail pane and show a small note "Not in current results" rather than clearing filters.
4. **State chip, not a banner, on the card.** At most three status marks: filled bookmark (saved), stage pill with colour by phase (neutral = saved/applied, blue = interviewing, green = offer, grey = closed), fit badge (number) once analysed. Keep card text order: title, company, location/mode, salary/posted, marks.
5. **Tracking panel in detail pane is a collapsible card at the top** for tracked jobs; untracked jobs show Save / Apply actions at the same spot. Description stays below so the user never loses the job they are tracking.
6. **Rail defaults to active applications, "needs attention" first, then most recent activity**; pipeline strip above it is the filter; closed applications appear only when "Closed" is selected. An empty rail shows a one-line explanation and how to start.
7. **One-click progress in the rail** (advance, close) with optimistic updates and Undo toast; rich editing happens in the detail pane's timeline.
8. **Responsive:** "desktop and tablet" means the rail (or results list) must collapse to a toggled drawer at tablet widths; plan the breakpoint behaviour in the design phase rather than discovering it late.
9. **Keyboard and focus:** arrow keys in list, Enter to open, Esc to close dialogs/popovers; visible focus rings; Radix handles dialogs, popovers and menus.
10. **Data freshness:** posted dates in seed data should be computed relative to server start (or day) so "2d ago" stays believable between demos.

---

## Competitor Feature Analysis

| Feature | LinkedIn Jobs | Indeed | Huntr / Teal / Simplify | Jobscan / Rezi | Our Approach |
|---------|---------------|--------|--------------------------|----------------|--------------|
| Search + filters | Keyword + location; date, experience, company, job type, remote, salary, Easy Apply, etc. | Similar plus "my jobs" | Not a search product (they import from other sites) | n/a | Five filters + chips; seeded data |
| Result card | Logo, title, company, location, posted, "Applied/Viewed" marker, promoted label | Salary prominent, snippet | n/a | n/a | Card + stage pill + saved + fit badge |
| Tracking pipeline | Job Tracker: Saved, Applied, Interviewing, Archived (separate page; 2,000-job cap on saved/archived) | "My Jobs": saved, applied, interviewing, offers, archived | Kanban: Wishlist/Saved, Applied, Interview, Offer, Rejected; custom columns | n/a | Per-application timeline, user-editable stages, same page as search |
| Per-job record | Notes, status | Notes, status | Notes, salary, contacts, URL, reminders, documents | n/a | Stage status/date/notes, app notes, snapshot of job |
| Reminders | None to speak of | Minimal | Follow-up dates, email nudges (Teal about one week) | n/a | On-page nudges, snooze |
| Metrics | None | None | Dashboard with counts, response/interview stats | n/a | Pipeline strip + response rate, strip filters rail |
| AI fit | "Am I a good fit" style features for premium members | Limited | Teal match score + keywords | Jobscan: match score, hard/soft skills with counts, missing keywords, predicted skills, ATS checks | Score, evidence-backed strengths and gaps, learning plan, tailoring tips, on demand |
| Resume editing | Profile | Resume upload | Teal/Huntr: builders and AI writing | Rezi: builder and scoring | **Not built**; tips only |
| Job chat | None | None | Teal/Simplify AI assistants (generic) | None | Per-job grounded chat |

---

## MVP Definition

### Launch With (v1)

Everything marked [IN] in PROJECT.md Active, plus the small [ADD] items that are table stakes.

- [ ] Seeded jobs API with about 60 to 100 realistic jobs (structured skills, long descriptions, spread across modes, levels, salaries, dates) — underpins everything
- [ ] Three-pane shell with LinkedIn-style chrome and modern inner design — first-class requirement
- [ ] Search box, location, five filters, chips, count, sort, Load more, empty/loading/error states
- [ ] Result card with viewed state, save toggle, stage pill, fit badge; keyboard navigation
- [ ] Job detail with structured description and "Apply on company site" → "Did you apply?" prompt
- [ ] Save and Mark applied (editable date); application snapshot of job info
- [ ] Stage timeline: default template, add/rename/remove/reorder with suggestions, status/date/notes, application notes
- [ ] Close with reason, reopen, closed view
- [ ] Rail with quick actions, Undo toasts, pipeline strip as filter, response rate with tooltip
- [ ] Nudges: gone quiet, upcoming, overdue; snooze
- [ ] Resume intake (PDF or paste), parsed profile review/edit, replace/delete
- [ ] Check my fit: score and band, strengths with evidence, required/nice-to-have gaps, learning plan, tailoring tips, in one structured call; cached by job id + resume hash; stale indicator
- [ ] Ask-about-this-job chat with suggested prompts, persisted per job
- [ ] Persistence with a versioned schema

### Add After Validation (v1.x)

- [ ] Export/import JSON and "clear all data" — trigger: first report of lost data, or before sharing with others (recommend pulling into v1 if cheap)
- [ ] Tracked-status filter in search (Not yet tracked / Saved / Applied / hide applied) — trigger: once the store is stable; very low cost, consider v1
- [ ] Score breakdown by dimension — trigger: score trust feedback
- [ ] Per-stage "with whom" field — trigger: users put names in notes
- [ ] Extra metrics (days to first response, interview rate) — trigger: users ask what the rate means
- [ ] Recent searches

### Future Consideration (v2+)

- [ ] Accounts, sync, real job feed — needs auth and storage
- [ ] Interview prep per stage — PROJECT.md deferred
- [ ] Email/push reminders and calendar — needs backend and accounts
- [ ] Local (non-AI) skill-overlap "hint" on results — only if on-demand analysis proves too slow a discovery loop
- [ ] Mobile layout, dark theme, i18n

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Three-pane shell + shared selection/search state | HIGH | MEDIUM | P1 |
| Search, filters, sort, cards, empty states | HIGH | MEDIUM | P1 |
| Seeded realistic jobs | HIGH | MEDIUM | P1 |
| Stage badge on result card | HIGH | MEDIUM | P1 |
| Stage timeline (template, edit, status/date/notes) | HIGH | MEDIUM | P1 |
| Save / Mark applied (+ "Did you apply?") | HIGH | LOW | P1 |
| Close with reason + reopen | HIGH | LOW | P1 |
| Rail quick actions + Undo | HIGH | LOW | P1 |
| Pipeline strip as filter + response rate | MEDIUM-HIGH | MEDIUM | P1 |
| Resume intake + review/edit profile | HIGH | MEDIUM | P1 |
| Check my fit (score, strengths, gaps) | HIGH | MEDIUM-HIGH | P1 |
| Learning plan + tailoring tips | HIGH | MEDIUM | P1 |
| Fit badge on card + cache + stale indicator | HIGH | MEDIUM | P1 |
| Nudges (quiet, upcoming, overdue, snooze) | MEDIUM-HIGH | MEDIUM | P1 |
| Job chat with suggested prompts | MEDIUM | MEDIUM | P1 |
| Persistence with schema version | HIGH | MEDIUM | P1 |
| Keyboard navigation, viewed state | MEDIUM | LOW | P2 |
| Tracked-status search filter | MEDIUM | LOW | P2 |
| Export/import JSON, clear data | MEDIUM | LOW | P2 |
| Score breakdown by dimension | MEDIUM | MEDIUM | P2 |
| Stage "with whom" | LOW-MEDIUM | LOW | P3 |
| Extra metrics | LOW | LOW | P3 |
| Recent searches | LOW | LOW | P3 |

**Priority key:** P1 must have for launch, P2 should have when possible, P3 nice to have.

---

## Open Decisions for Requirements

These were not settled by PROJECT.md. Recommend resolving them in requirements; defaults given.

1. **Pipeline strip bucket rules and response rate definition** — default: mutually exclusive derived buckets (see section D); response = moved beyond Applied or closed as rejected after a reply, over all ever-applied.
2. **Nudge thresholds** — default: 14 days quiet after Applied, 7 days quiet after an interview stage, 3 days lookahead for dated stages, snooze 7 days.
3. **"Add external application" (job not in seeded data)** — every real tracker has this, and users apply to jobs not in the feed, but it overlaps the "search" premise. Recommend **defer to v1.x**; the data model (application snapshot of job info) already makes it a small addition.
4. **Whether a stage "failed" auto-prompts close** — recommended yes.
5. **Fit score bands and whether the headline derives from sub-scores** — recommended bands above; derive in code if sub-scores are included.
6. **Chat persistence** — recommended per-job thread in the browser, with a cap on stored messages.
7. **Resume text extraction location** (browser vs server vs Claude PDF input) — a stack decision, noted here because it determines the scanned-PDF failure mode and privacy statement.

---

## Sources

- Web search spot-checks (MEDIUM confidence, aggregator and review sites, not first-party docs):
  - Huntr default columns and card fields: https://scoutify.com/blog/huntr-review, https://guides.huntr.co/job-seeker
  - Teal tracker statuses, follow-up reminders, match score: https://www.unite.ai/tealhq-review, https://scoutify.com/blog/teal-review, https://jobshinobi.com/compare/job-tracking-apps-like-teal-2026
  - Jobscan match report contents (hard/soft skills, counts, missing and predicted keywords, 30+ checks): https://www.jobscan.co/video-resume-match-report, https://www.jobscan.co/resume-score
  - LinkedIn Job Tracker categories (Saved, Applied, Interviewing, Archived; 2,000 saved cap): https://www.linkedin.com/help/linkedin/answer/a513247
  - Indeed My Jobs: https://www.indeed.com/help/job-seekers/articles/205332490-what-is-my-jobs
- Product knowledge (MEDIUM): LinkedIn Jobs filter set and card conventions, Indeed, Wellfound and Otta/Welcome to the Jungle search and card layout, Simplify, Rezi. Not individually re-verified this session.
- Recommendations (thresholds, bucket rules, bands) are the researcher's judgment (LOW-MEDIUM) and are listed under Open Decisions rather than presented as standards.

---
*Feature research for: job search page with application tracking and AI fit analysis*
*Researched: 2026-10-10*
