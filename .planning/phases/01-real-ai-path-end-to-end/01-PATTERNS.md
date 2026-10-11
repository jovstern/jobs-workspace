# Phase 1: Real AI path, end to end - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** about 55 new or modified (grouped below)
**Analogs found:** 19 with a real analog / about 55. The scaffold is tiny, so most new files have no analog. Those are listed plainly under "No Analog Found". Use RESEARCH.md for them.

All analog paths below were checked against `git ls-files` and are tracked. Do not use `.claude/skills/kickoff/template/**` copies as analogs. They are duplicates of the root files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/resume/PasteForm.tsx` | component (form) | request-response | `src/features/greeting/GreetingForm.tsx` | exact |
| `src/features/resume/TextStep.tsx` (step 1 textarea) | component (form) | request-response | `GreetingForm.tsx` | role-match |
| `src/features/resume/ProfileStep.tsx` (profile editor) | component (form) | CRUD | `GreetingForm.tsx` | role-match |
| `src/features/resume/ResumeDialog.tsx` | component (dialog) | request-response | none | no analog |
| `src/features/resume/mutations.ts`, `src/features/fit-analysis/mutations.ts` | hook (TanStack mutation) | request-response | `src/lib/query-client.ts` (config only) | partial |
| `src/features/resume/resume-store.ts`, `fit-store.ts`, `src/lib/persisted-store.ts` | store (Zustand persist) | CRUD | none | no analog |
| `src/features/fit-analysis/FitPanel.tsx`, `selectors.ts` | component, utility | transform | none | no analog |
| `src/features/jobs-stub/JobPicker.tsx`, `queries.ts` | component, hook (query) | request-response | none (only `queryClient`) | no analog |
| `src/lib/api.ts`, `sha256.ts` | utility | request-response / transform | none | no analog |
| `src/App.tsx` (modify) | component | n/a | itself | exact |
| `src/main.tsx` (modify, if storage notice or providers are added) | config | n/a | itself | exact |
| `*.test.tsx` beside each component | test | request-response | `GreetingForm.test.tsx` | exact |
| `src/test/setup.ts` (modify if localStorage reset needed) | config | n/a | itself | exact |
| `shared/package.json`, `shared/src/*.ts` (schemas) | model / utility | transform | `server/src/app.ts` lines 4-5 (schema + inferred type) | partial |
| `shared/src/fit/score.ts`, `text/redact.ts` + tests | utility (pure) | transform | none for code; test style from `app.test.ts` | no analog |
| `server/src/app.ts` (modify: `createApp({ ai, env })`, mount routers, error handler) | route / config | request-response | itself | exact |
| `server/src/{resume,fit,jobs}/routes.ts` | route | request-response | `server/src/app.ts` lines 12-15 | role-match |
| `server/src/{resume,fit,jobs}/*.test.ts`, `ai/*.test.ts` | test | request-response | `server/src/app.test.ts` | exact |
| `server/src/index.ts` (modify: env, inject real AI client) | config | n/a | itself | exact |
| `server/src/config/env.ts`, `config/models.ts` | config | n/a | none | no analog |
| `server/src/http/{errors,validate,request-log,local-origin}.ts`, rate limiter | middleware | request-response | none | no analog |
| `server/src/ai/*`, `fit/analyze.ts`, `fit/quotes.ts`, `resume/extract-pdf.ts`, `text-quality.ts` | service | request-response | none | no analog |
| `server/src/test-support/fake-gemini.ts` | test utility | request-response | `app.test.ts` lines 6-18 (listen on port 0 pattern) | partial |
| `server/data/seed-jobs.json`, `server/src/jobs/seed.ts` | data / service | CRUD (read-only) | none | no analog |
| `vite.config.ts` (modify: `/api` proxy, `test.include` + `shared/**`) | config | n/a | itself | exact |
| `playwright.config.ts` (modify: array `webServer`, `grepInvert`) | config | n/a | itself | exact |
| `e2e/resume-fit.spec.ts`, `e2e/no-secrets.spec.ts` | test (e2e) | request-response | `e2e/smoke.spec.ts` | role-match |
| root `package.json`, `server/package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `CLAUDE.md` | config | n/a | themselves | exact (edit list in RESEARCH Part E) |

## Pattern Assignments

### Resume forms: `PasteForm.tsx`, `TextStep.tsx`, `ProfileStep.tsx` (component, request-response / CRUD)

**Analog:** `src/features/greeting/GreetingForm.tsx` (the CONTEXT-named reference form)

**Imports and schema** (lines 1-7):
```typescript
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { z } from 'zod'

const greetingSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
})
```
For this phase, import the schema from `@jobs-workspace/shared` instead of defining it inline.

**Form core** (lines 13-29): Zod schema passed directly as `validators.onSubmit` (no adapter), `noValidate`, submit goes through `void form.handleSubmit()`:
```typescript
const form = useForm({
  defaultValues: { name: '' },
  validators: { onSubmit: greetingSchema },
  onSubmit: ({ value }) => { /* ... */ },
})
<form noValidate onSubmit={(event) => { event.preventDefault(); void form.handleSubmit() }}>
```
For the resume forms, `onSubmit` calls `mutation.mutate(...)`. `onSubmit` is not where the store write happens (store write goes in the mutation `onSuccess`, see RESEARCH Pattern 3).

**Accessible field pattern** (lines 30-57), copy exactly for every field (textarea, headline, years, role fields):
```typescript
<form.Field name="name">
  {(field) => {
    const error = field.state.meta.errors[0]?.message
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={field.name} className="text-sm font-medium">Name</label>
        <input
          id={field.name} name={field.name} value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => { field.handleChange(event.target.value) }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${field.name}-error` : undefined}
        />
        {error ? (<p id={`${field.name}-error`} role="alert" className="text-sm text-red-600">{error}</p>) : null}
      </div>
    )
  }}
</form.Field>
```
Notes: one component per file, named export, no `useMemo`/`useCallback`/`memo` (ESLint bans them, `eslint.config.js` lines 38-49). Styling is Tailwind utility classes. The UI-SPEC wraps Radix `Dialog`/`Tabs` etc. and may restyle, but keep the label, `aria-invalid`, `aria-describedby` and `role="alert"` structure. The `role="status"` on line 64 is the pattern for non-error result messages. The profile editor's dynamic skill chips and role rows have no analog (use TanStack Form array fields from its docs).

---

### Component tests (component tests beside each component)

**Analog:** `src/features/greeting/GreetingForm.test.tsx` (lines 1-25)
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { GreetingForm } from './GreetingForm'

test('rejects a name that is too short', async () => {
  const user = userEvent.setup()
  render(<GreetingForm />)
  await user.type(screen.getByLabelText('Name'), 'A')
  await user.click(screen.getByRole('button', { name: 'Greet' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('at least 2 characters')
})
```
Query by label and role, `userEvent.setup()` per test, `findBy*` for async results. Cleanup is automatic via `src/test/setup.ts` lines 1-7 (`cleanup()` in `afterEach`). Components that use mutations need a `QueryClientProvider` wrapper in tests. There is no existing wrapper helper, so create one in `src/test/` (new). Use a fresh `QueryClient` per test, not the shared one.

---

### Mutations and queries (`mutations.ts`, `queries.ts`)

**Analog:** `src/lib/query-client.ts` (lines 1-5) and its provider mount in `src/main.tsx` lines 12-18
```typescript
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
```
This is config only, for queries. It sets no `mutations` defaults. Phase 1 AI mutations must set `retry: false` explicitly (paid calls, CONTEXT code_context). The `queries.retry: 1` default must not reach any AI call. There is no existing mutation or query hook to copy. Follow RESEARCH Part D.2 and Pattern 3. The ESLint plugin `@tanstack/eslint-plugin-query` is active (`eslint.config.js` line 29), so write hooks that satisfy it.

---

### `src/App.tsx` (modify)

**Analog:** itself, lines 1-10. The stub page replaces `<GreetingForm />` inside `<main>`. Keep the shape of a named-export `App`, no props. The greeting feature (`src/features/greeting/`) may be deleted once the resume feature replaces it. Its smoke e2e (`e2e/smoke.spec.ts`) must then be replaced or removed in the same change.

---

### `server/src/app.ts` (modify) and new routers (`resume/routes.ts`, `fit/routes.ts`, `jobs/routes.ts`)

**Analog:** `server/src/app.ts` (lines 1-18)
```typescript
import express from 'express'
import { z } from 'zod'

export const healthResponseSchema = z.object({ status: z.literal('ok') })
export type HealthResponse = z.infer<typeof healthResponseSchema>

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' }
    res.json(body)
  })
  return app
}
```
Patterns to keep: factory `createApp()` (extend to `createApp({ ai, env })` for injection, RESEARCH Pattern 1), `x-powered-by` disabled, response bodies typed by a Zod-inferred type, no `.js` import suffixes (see `index.ts`: `from './app'`), and no semicolons. Move `healthResponseSchema` into `shared/` and extend it with `aiConfigured: boolean` (RESEARCH F.3). This breaks the existing assertion at `app.test.ts:24` (`toEqual({ status: 'ok' })`), so update that test in the same change. Routers, the central error handler, request validation, upload handling and rate limiter have no analog (see below).

**Entry point** `server/src/index.ts` lines 3-8: keep loopback-only bind and the explanatory comment. Env loading and the real AI client get wired here.

---

### Server route tests

**Analog:** `server/src/app.test.ts` (lines 1-31). Real listening port, real `fetch`, schema-parsed responses:
```typescript
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createApp, healthResponseSchema } from './app'

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${String(port)}`
})
afterAll(() => { server.close() })

test('GET /api/health reports ok', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  expect(response.status).toBe(200)
  expect(healthResponseSchema.parse(await response.json())).toEqual({ status: 'ok' })
})
```
Reuse for every new route test: pass `createApp({ ai: fakeAiClient })`, assert status and parse the body with the shared schema. The listen-on-0 block is also the model for `test-support/fake-gemini.ts` (a `node:http` server, RESEARCH F.2), but the fake itself has no analog.

---

### Shared package: `shared/src/*.ts`, `shared/package.json`

**Analog (schema style only):** `server/src/app.ts` lines 4-5: export the Zod schema and the `z.infer` type side by side. Package layout, `exports`, and the isomorphism rule (no DOM, no `node:*`) come from RESEARCH Part E, not from the codebase. Zod 4 is `^4.6.5` in `server/package.json` line 19. Match the version in the root. No existing workspace package to copy.

---

### Config edits: `vite.config.ts`, `playwright.config.ts`

**`vite.config.ts`** lines 6-13. The existing block to extend:
```typescript
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```
Add `'shared/**/*.test.ts'` to `include` and a top-level `server: { proxy: { '/api': ... } }` (RESEARCH F.1). `vite preview` inherits it. Note: `environment: 'jsdom'` also applies to shared tests. Keep shared code DOM-free anyway.

**`playwright.config.ts`** lines 5-23. Existing `webServer` is a single object with `reuseExistingServer: !isCI` (line 21). RESEARCH F.1 converts it to an array and forces `reuseExistingServer: false` for the API and fake entries. Keep the `isCI` constant style and `video: { mode: 'on', ... }` (line 13), since the demo GIF depends on it.

---

### e2e specs: `e2e/resume-fit.spec.ts`, `e2e/no-secrets.spec.ts`

**Analog:** `e2e/smoke.spec.ts` (lines 1-8)
```typescript
import { expect, test } from '@playwright/test'

test('greeting form works end to end', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Name').fill('Ada')
  await page.getByRole('button', { name: 'Greet' }).click()
  await expect(page.getByRole('status')).toHaveText('Hello, Ada!')
})
```
Use label and role locators, relative `page.goto('/')` (baseURL from config). Upload of a PDF fixture, `@real-ai` tagging, fake-Gemini scenario control and the secret scan have no analog (RESEARCH F.2, F.3).

## Shared Patterns

### Code style (all files)
**Source:** `.prettierrc.json`, observed in every analog. No semicolons, single quotes, 100 columns, trailing commas in multiline. `String(port)` used inside template literals (strict lint). TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`: use `import type` for type-only imports (`app.test.ts` lines 1-2).

### Accessible form errors
**Source:** `src/features/greeting/GreetingForm.tsx` lines 32-54. Apply to every form and every inline error in the resume flow.

### No manual memoization
**Source:** `eslint.config.js` lines 37-49. Apply to every client file. The React Compiler handles it. Persisted Zustand under the Compiler is covered in RESEARCH D.1.

### Validate with Zod, parse at boundaries
**Source:** `server/src/app.test.ts` line 24 (`healthResponseSchema.parse(...)`) and `GreetingForm.tsx` line 13-15. Apply: client parses API responses with the shared schemas, server routes parse request bodies with them.

### Server is stateless and loopback-only
**Source:** `server/src/index.ts` lines 5-6. Apply: no storing or logging of resumes, bodies or model output, and no logging of env values or Zod inputs.

### Lint scope
Root ESLint ignores `server` (`eslint.config.js` line 20). Server has its own config. Per RESEARCH Part E, `shared/` is linted by the root config with no change.

## No Analog Found

Use RESEARCH.md for these (section noted).

| File | Role | Data Flow | Reason / where to look |
|---|---|---|---|
| `src/lib/persisted-store.ts`, `resume-store.ts`, `fit-store.ts` | store | CRUD | No Zustand yet (D.1, Pattern 3, 4) |
| `src/lib/api.ts`, `JobPicker.tsx`, `queries.ts`, `FitPanel.tsx`, `selectors.ts` | client data / UI | request-response, transform | No fetch wrapper, queries or result views exist (D.2, UI-SPEC) |
| `ResumeDialog.tsx`, shared `Modal`, `ConfirmDialog`, `StorageNotice` | component | n/a | No Radix or dialog code yet (UI-SPEC Design System) |
| `src/lib/sha256.ts` | utility | transform | Browser `crypto.subtle` (B.4) |
| `shared/src/fit/score.ts`, `shared/src/text/redact.ts` | utility | transform | Pure logic (B.3, C.3) |
| `server/src/config/{env,models}.ts` | config | n/a | No env loading yet (F.3, A.3) |
| `server/src/http/*`, rate limiter (D-19), upload route | middleware | request-response | No middleware besides `express.json()` (C.2, Pitfall 10) |
| `server/src/ai/*`, `fit/analyze.ts`, `fit/quotes.ts` | service | request-response | No AI code (Pattern 1, A.1-A.8, B.1-B.2) |
| `server/src/resume/extract-pdf.ts`, `text-quality.ts` | service | file-I/O | (C.1) |
| `server/src/test-support/fake-gemini.ts` | test utility | request-response | Only the listen-on-0 snippet is reusable (F.2) |
| `server/src/jobs/seed.ts`, `seed-jobs.json` | data | read-only | Authoring task per D-14, D-15 |

## Metadata

**Analog search scope:** all git-tracked files (`git ls-files`), excluding `.planning` and lockfiles. `.claude/skills/kickoff/template/**` duplicates root files and was ignored.
**Files read:** 12 source files plus `eslint.config.js`, `server/package.json`, CONTEXT.md and RESEARCH.md sections (structure, E, F). `server/.env` was not read.
**Pattern extraction date:** 2026-10-10
