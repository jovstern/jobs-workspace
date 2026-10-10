# Jobs Workspace

## What This Is

A redesigned, LinkedIn-style jobs page for a single job seeker: one three-pane workspace
where searching for jobs, tracking applications and getting AI fit analysis all happen
without leaving the page. It is "a new smart, personal place to search and monitor the
next role": not only a place to look for a job, but one that helps the user find their best
fit and shows what is missing from their resume or what they need to learn.

## Core Value

The user can search for jobs and see and update the progress of every application on the
same page, without ever losing their search context.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Three-pane jobs workspace: results list, selected job, persistent "My applications" rail
- [ ] Search and filter over realistic seeded job listings served by our own server
- [ ] A job in search results that the user has saved or applied to shows its current stage
      on the result card, and opens to its stage timeline
- [ ] "Save" a job and "Mark as applied" (tracking only, no application is submitted)
- [ ] Per-application stage timeline: each stage has a name, status (upcoming, in progress,
      passed, failed, skipped), date and free notes
- [ ] New applications start from a common template (Saved → Applied → Recruiter screen →
      Technical interview → Final round → Offer)
- [ ] User can add, remove, rename and reorder stages without limit, choosing from suggested
      common stages (Take-home, System design, HR call, Reference check, ...) or typing their own
- [ ] Close an application with a reason (rejected, withdrew, offer accepted, offer declined,
      no reply); closed applications leave the active list but keep their history
- [ ] Pipeline summary strip (saved / applied / interviewing / offers / closed, response rate)
      that filters the rail when clicked
- [ ] On-page needs-attention nudges: applications gone quiet, stages dated in the next few days
- [ ] Resume intake by PDF upload or pasted text; AI turns it into a structured profile
- [ ] On-demand "Check my fit" for the open job, using a real AI model: fit score, matched
      strengths, gaps
- [ ] Learning plan for each gap (what to learn, rough effort)
- [ ] Resume tailoring tips per job (what to emphasise, missing keywords)
- [ ] Ask-about-this-job chat on the open job
- [ ] Once a job has been analysed, its fit score shows on its result card
- [ ] Resume, applications, stages and cached analyses persist in the browser across refresh
- [ ] LinkedIn-like shell (colours, fonts, top navigation, overall structure) with a modern,
      clean redesign inside the jobs page

### Out of Scope

- Real job feeds or scraping LinkedIn — no public API, scraping breaks their terms; seeded data first
- Accounts, login, sync across devices — single user for the first version; add in a later milestone
- Submitting applications or a simulated Easy Apply form — people apply on the employer's site; we record it
- Automatic fit scores on every search result — cost and latency; analysis is on demand
- Interview prep per stage — deferred to a later milestone
- Mobile layout — first version targets desktop and tablet widths
- Email or push reminders — nudges are on-page only
- Other LinkedIn pages (Home, Network, Messaging, Profile) — nav items are present but inert
- Dark theme, languages other than English, right-to-left layout — not needed for first version

## Context

- **Problem with LinkedIn today:** the user has no good view of the jobs they applied to or
  their progress in a given application. The Job Tracker is a separate page from Job Search, so
  going there loses the search context and the connection between the two. The tracker itself
  is poor at representing the stages of a specific application.
- **Design direction (user's words):** "keep the main look and feel of linkedin but change the
  overall UI/UX and styling. LinkedIn pages look old and not so user friendly, so keep their
  colors and fonts and the main structure, but inside our new jobs page feel free to design
  something more modern and sleek, but of course UI and UX come first."
- **UI and styling are a first-class requirement**, not polish to add at the end.
- The user explicitly encouraged adding common scenarios that improve the page; the pipeline
  strip, nudges and close-out reasons came from that.
- The search list and the applications rail are two views of the same application data and
  must never disagree.
- LinkedIn's look is evoked (palette, system font stack, layout). Its logo and trademarked
  assets are not used.

## Constraints

- **Tech stack**: Fixed by `.claude/skills/stack-conventions` (Vite, React with the compiler,
  TypeScript strict, Tailwind, Radix, TanStack Query and Form, Zod, Zustand, Express in
  `server/`) — decided before kickoff; not open for alternatives
- **Backend**: Stateless Express server — serves seeded jobs and proxies AI calls; holds no user data
- **Persistence**: Browser storage only — user chose no server-side user data for the first version
- **AI**: Claude via the Anthropic API, called only from the server — the API key must never
  reach the browser; supplied by the user in a local `.env`
- **Privacy**: The resume is sent to the server only as part of an AI request and is not stored there
- **Process**: Every phase must end in something visibly working that a short GIF can show;
  the riskiest unknown is proven first

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Seeded job data instead of a real feed | Fastest path to a polished, working page; a feed can be swapped in later | — Pending |
| Three-pane workspace layout | Search, detail and tracking visible together; nothing navigates away | — Pending |
| Tracked state shown on search result cards | User requirement: a job already applied to must reflect its stages in search | — Pending |
| Track, don't submit | Matches real behaviour; avoids building a fake application form | — Pending |
| Stages carry status, date and notes | Rich enough to be a real tracker without reminders infrastructure | — Pending |
| Real AI model from the first version | The "smart" part is the differentiator; needs a backend | — Pending |
| Fit analysis only when the user asks | Controls cost and latency; no per-result model calls | — Pending |
| Resume via PDF upload or pasted text | Lowest friction for the user | — Pending |
| Single user, data in the browser | No auth phase before the page is visible | — Pending |
| Desktop and tablet first | Three-pane layout is the core; mobile is its own design problem | — Pending |
| Fit score computed in code from per-requirement ratings with resume quotes | A model-made number is unstable and can be manipulated by text in a job post | — Pending |
| AI results (fit analyses, parsed resume, chat history) live in persisted Zustand stores | User sign-off on the "never copy server data into Zustand" rule: these are the user's own paid, non-refetchable records | — Pending |
| Chat streams inside a TanStack Query mutation | User sign-off on the "every fetch through TanStack Query" rule; stable APIs, no accidental repeat of a paid call | — Pending |
| Add TanStack Router for URL state | User chose a router library over a hand-written helper; an approved addition to the fixed stack | — Pending |
| Applications store the job id only, no job snapshot | Keeps server data out of stores; seeded ids are fixed and tested; missing job renders "listing unavailable" | — Pending |
| Stage reorder by Move up / Move down in v1; drag and drop deferred | Buttons are required for accessibility anyway; drag library is unproven with the React Compiler | — Pending |
| Export, import and erase-all in v1 | Browser-only data is lost when site data is cleared (Safari clears after 7 idle days) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-10 after initialization*
