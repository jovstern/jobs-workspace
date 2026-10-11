# Deferred items, Phase 01

Out-of-scope discoveries logged during execution. Not fixed by the plan that found them.

## Found in plan 01-05

- `src/features/greeting/GreetingForm.tsx` uses padding and gap steps `3` (`gap-3`, `px-3`), which the Phase 1 UI contract forbids for new work. It is the pre-existing reference form from the scaffold, not part of the Phase 1 page, and was not touched. Decide in a later plan whether to restyle it or delete it with the rest of the scaffold.
- `src/features/fit-analysis/FitPanel.tsx` (tracer) still renders its own `section` and a level-2 heading with the job title, so the selected job's title appears twice and the detail pane contains a fourth `section`. Plan 01-10 rewrites the panel (heading becomes "Your fit for {job title}") and is the right place to fix it.
