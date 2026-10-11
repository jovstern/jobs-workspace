---
phase: 01-real-ai-path-end-to-end
plan: 01
subsystem: infra
tags: [npm-workspaces, zod, gemini, zustand, vite-proxy, ci]
status: complete

requires: []
provides:
  - "@jobs-workspace/shared npm workspace (private, TypeScript entry, zod ^4.6.5)"
  - "healthResponseSchema (status + aiConfigured) and the typed error envelope (ERROR_CODES, apiErrorSchema, isKnownErrorCode)"
  - "@google/genai 2.28.0 pinned exactly in the server workspace; zustand 5.0.15 in the root"
  - "One root lockfile; CI installs once; shared tests run in the root gate"
  - "Vite dev-server /api proxy to API_PROXY_TARGET or http://127.0.0.1:3001"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: 64ab228eace4dc27c71430a1d969430c52750dbe
plan_head_after: 0474482bf176ae26c8957942dc26e8a9ef821b91

tech-stack:
  added: ["@google/genai@2.28.0 (server)", "zustand@5.0.15 (root)", "@jobs-workspace/shared (local workspace)"]
  patterns:
    - "Schema-plus-inferred-type in shared/, isomorphic (no DOM globals, no node: imports)"
    - "Wire error code is a plain string so later phases can add codes without breaking an older client"

key-files:
  created:
    - shared/package.json
    - shared/src/index.ts
    - shared/src/health.ts
    - shared/src/error.ts
    - shared/src/contracts.test.ts
  modified:
    - package.json
    - server/package.json
    - package-lock.json
    - tsconfig.json
    - vite.config.ts
    - .github/workflows/ci.yml
    - CLAUDE.md
  deleted:
    - server/package-lock.json

key-decisions:
  - "Task 1 registry check approved by the user: install exactly @google/genai 2.28.0 (D-20)"
  - "tsconfig include change moved from Task 3 into the Task 2 commit because the pre-commit lint could not parse shared/ without it"

requirements-completed: [DATA-07]
---

# Phase 1 Plan 01: Shared workspace and pinned dependencies Summary

**npm workspace `@jobs-workspace/shared` with the health and error contracts, Gemini SDK pinned at 2.28.0 in the server only, one root lockfile, and shared tests running in the root gate.**

## Accomplishments

- Task 1 (checkpoint, handled by the orchestrator): the user approved `@google/genai` 2.28.0 after the registry check (repository googleapis/js-genai, Apache-2.0, `latest` dist-tag, only install script is a no-op `preinstall`). Recorded as D-20.
- Task 2: created `shared/` (`healthResponseSchema` with `aiConfigured`; `ERROR_CODES` with the nine codes, `isKnownErrorCode`, `apiErrorSchema`), added `workspaces` and the shared dependency to both package files, removed `server/package-lock.json`, reinstalled from a clean tree, then installed the SDK (exact, server workspace) and `zustand`. Added the `fake-gemini` and `spike:live` scripts, which point at files created in plans 01-02 and 01-09.
- Task 3 (TDD): wrote three contract tests first (RED: "No test files found"), then added `shared/**/*.test.ts` to the Vitest include (GREEN: 3 passing), the `/api` dev proxy, the single-install CI change and the CLAUDE.md workspace bullet.

## Verification

- `npm ci`: no errors. `npm ls zod`: one copy, 4.6.5, everything else deduped. `npm ls @google/genai`: 2.28.0 under `jobs-workspace-server` only. `npm ls @jobs-workspace/shared`: linked from `./shared` for root and server.
- `npm --prefix server run check`: lint, typecheck and 2 tests pass.
- `npx vitest run shared/src/contracts.test.ts`: 3 passed. Full root test run: 5 passed.
- Root `lint`, `typecheck`, `build` pass. `prettier --check . '!.gsd'` passes. `npm run check` as a single command did NOT pass, see Issues.
- `npm run e2e`: 1 passed (existing smoke test).
- CI workflow has exactly one `run: npm ci` and still runs `npm run check` in `server`. `eslint.config.js`, `server/eslint.config.js` and `server/tsconfig.json` are untouched.

## Task Commits

| Task | Commit | Notes |
|---|---|---|
| 1 | none | blocking human checkpoint, approved |
| 2 | ef6431f | shared workspace, SDK, zustand, lockfile, tsconfig include |
| 3 RED | e9af9be | contract tests (not collected until the include change) |
| 3 GREEN | 0474482 | Vitest include, proxy, CI, CLAUDE.md |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsconfig.json` include moved into the Task 2 commit**
- **Found during:** Task 2 commit
- **Issue:** The pre-commit ESLint hook failed with "not found by the project service" for `shared/src/*.ts` because `tsconfig.json` did not yet include `shared`.
- **Fix:** Applied the approved (D-16) `include` change in the Task 2 commit instead of Task 3, rather than bypassing the hook.
- **Files modified:** tsconfig.json
- **Commit:** ef6431f

**2. [Rule 3 - Process] Task 3 split into a RED and a GREEN commit** per the TDD reference; the RED commit passes the pre-commit hooks because they do not run tests.

## Issues Encountered

- `npm run check` fails at its first step, `prettier --check .`, on `/Users/yoav/Mnt/gsd-pilot/.gsd/dispatch-isolation-sentinel.json`. That file is an untracked, git-ignored runtime file written by the orchestrator at 09:48 (its own `.gsd/.gitignore` hides it from git, but Prettier only reads the root ignore files). It is not part of this plan, so it was left alone, and `.prettierignore` was not changed (gate configuration needs user approval). Every other step of `check` was run individually and passes. The orchestrator or user should either delete the sentinel when dispatch ends or add `.gsd` to `.prettierignore` with approval.
- npm prints an `allow-scripts` warning for five packages with install scripts (esbuild, fsevents, lefthook, protobufjs, `@google/genai` no-op `preinstall`). No `allowScripts` configuration was added; installs and the hook setup work.

## Known Stubs

None. The `fake-gemini` and `spike:live` scripts point at files that plans 01-02 and 01-09 create; running them before then fails, as planned.

## Threat Flags

None. No new network endpoint or trust boundary beyond the plan's threat model. T-01-SC mitigated by the Task 1 gate and exact pin; T-01-01 by `"private": true` and the workspace link (confirmed with `npm ls @jobs-workspace/shared`).

## Self-Check: PASSED

- FOUND: shared/package.json, shared/src/index.ts, shared/src/health.ts, shared/src/error.ts, shared/src/contracts.test.ts
- FOUND commits: ef6431f, e9af9be, 0474482
