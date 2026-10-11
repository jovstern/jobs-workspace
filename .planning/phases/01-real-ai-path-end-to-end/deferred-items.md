# Deferred items, Phase 01

Out-of-scope discoveries logged during execution. Not fixed by the plan that found them.

## Found in plan 01-05

- `src/features/greeting/GreetingForm.tsx` uses padding and gap steps `3` (`gap-3`, `px-3`), which the Phase 1 UI contract forbids for new work. It is the pre-existing reference form from the scaffold, not part of the Phase 1 page, and was not touched. Decide in a later plan whether to restyle it or delete it with the rest of the scaffold.
- `src/features/fit-analysis/FitPanel.tsx` (tracer) still renders its own `section` and a level-2 heading with the job title, so the selected job's title appears twice and the detail pane contains a fourth `section`. Plan 01-10 rewrites the panel (heading becomes "Your fit for {job title}") and is the right place to fix it.

## Found in the code review (WR-06)

- `src/features/fit-analysis/FitPanel.tsx` shows the one generic retryable message and always offers "Try again", whatever the error code. `ApiError` already carries `code` and `retryable`, so a non-retryable failure (`forbidden_origin`, `validation_error`, `unsupported_media_type`, `payload_too_large`) still shows a retry button. The reviewer's sharpest example is `forbidden_origin`: when Vite picks port 5174 because 5173 is busy, the Origin is not in `DEFAULT_ALLOWED_ORIGINS`, every fit check fails with "Something went wrong on our side", and nothing points at the local setup. Suggested direction: show "Try again" only when the failure is retryable, and give `forbidden_origin` its own line ("The app server refused this page's address. Open the app at http://localhost:5173 or set ALLOWED_ORIGINS.").
- Disposition: deferred to Phase 01.1 (FIT-11). The per-error message table and the retry behaviour belong there by the scope split; this phase deliberately ships one generic retryable message. Not changed in Phase 1.
