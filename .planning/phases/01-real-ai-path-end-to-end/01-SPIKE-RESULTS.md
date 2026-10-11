# Phase 01 Spike Results: live fit call against gemini-3.8-flash

Plan 01-09. Numbers, ids and enum values only. No resume text, no model text, no prompt and no key appear in this file.

## Run

| Item | Value |
|------|-------|
| Date | 2026-10-11 |
| Model id | `gemini-3.8-flash` (listed as stable on Google's model page on the same day) |
| SDK | `@google/genai` 2.28.0 |
| Code path measured | `analyzeFit`, the same path the route uses, with per-call overrides for thinking level, output cap and deadline |
| Resume | the committed synthetic `e2e/fixtures/resumes/frontend-senior.txt` only |
| Pairs | near-perfect: that resume against `job-frontend-senior`; poor: the same resume against `job-data-scientist-senior` |
| Spike limits (loosened so real usage shows) | output cap 16384 tokens, deadline 60000 ms |
| Schema accepted by the API | Yes. Every one of the 19 answered calls returned schema-valid ratings. There was no `schema_mismatch`, so no short ratings array and no out-of-job id occurred. |

### The three live runs, stated plainly

The live command was started three times in total. Only the third produced measurements.

| Run | Started by | Requests | Result |
|-----|-----------|----------|--------|
| 1 | executor, on the user's first go-ahead | 3 | All three refused in 142 to 289 ms. The script's three-failures-in-a-row rule stopped it. The error detail was hidden by design, so the cause was unknown. |
| 2 | orchestrator, after the status-only diagnostic was added (commit 14cb4d0) | 3 | All three refused by Google with HTTP 403 `PERMISSION_DENIED`. This is a key problem. The user fixed the key. No tokens were reported. |
| 3 | orchestrator, on the user's direct instruction | 22 | The measuring run. 19 answered, 3 aborted at the 60 s spike deadline. Not stopped early. |

Total model requests across all runs: 28. The six refused requests reported no tokens. All figures below are from run 3.

## Measurements (run 3)

Latency is wall clock per call in milliseconds, nearest-rank percentiles. Tokens are means over the calls that answered. "Required met" lists the number of the six required requirements rated `met`, one entry per answered run.

| Level | Pair | Calls | Failed | p50 ms | p90 ms | Prompt tok | Thought tok | Output tok | Max thought+output | Required met per run | Flips | Rejected quotes |
|-------|------|------:|-------:|-------:|-------:|-----------:|------------:|-----------:|-------------------:|----------------------|------:|----------------:|
| LOW | near-perfect | 5 | 0 | 4314 | 4698 | 1417 | 0 | 635 | 646 | 6, 6, 6, 6, 6 | 0 | 0 |
| LOW | poor | 5 | 0 | 3538 | 7017 | 1371 | 0 | 481 | 490 | 0, 0, 0, 0, 0 | 0 | 0 |
| MEDIUM | near-perfect | 3 | 0 | 14046 | 16900 | 1417 | 1738 | 635 | 2711 | 6, 6, 6 | 0 | 0 |
| MEDIUM | poor | 3 | 0 | 11043 | 15668 | 1371 | 1525 | 476 | 2629 | 0, 0, 0 | 0 | 0 |
| HIGH | near-perfect | 3 | 1 | 56097 | 60007 | 1417 | 8186 | 448 | 9775 | 6, 6 | 0 | 0 |
| HIGH | poor | 3 | 2 | 60002 | 60009 | 1371 | 3447 | 296 | 3743 | 0 | 0 | 0 |

Per level, across both pairs:

| Level | Calls | Failed | p50 ms | p90 ms | Max thought+output tokens | Average flips per pair |
|-------|------:|-------:|-------:|-------:|--------------------------:|-----------------------:|
| LOW | 10 | 0 | 3688 | 4698 | 646 | 0 |
| MEDIUM | 6 | 0 | 11043 | 16900 | 2711 | 0 |
| HIGH | 6 | 3 | 56097 | 60009 | 9775 | 0 |

Notes on the table:

- The three HIGH failures were all `aborted` (`AbortError`, no HTTP status) at the 60 s spike deadline: the call was cut off by our own deadline, not refused by Google. The three HIGH calls that answered took 21639, 52547 and 56097 ms.
- Flips are counted over the runs that answered. HIGH poor has a single answered run, so its zero flips says little.
- LOW used no thinking tokens at all (`thoughtTokens` 0 on all ten calls). MEDIUM used about 1000 to 2150 and HIGH about 3400 to 9300.
- Every answered call finished with `STOP`.

## The rule and the choice

The rule from plan 01-09: the lowest level whose p90 latency is at most 15 s, whose near-perfect runs all met all six required requirements, whose poor runs all met at most two, whose average flips per pair is at most 1, and with no failed calls.

| Level | p90 at most 15 s | Near-perfect all 6 met | Poor at most 2 met | Flips at most 1 | No failures | Qualifies |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| LOW | yes (4698 ms) | yes | yes (0) | yes (0) | yes | **yes** |
| MEDIUM | no (16900 ms) | yes | yes | yes | yes | no |
| HIGH | no (60009 ms) | yes | yes | yes | no (3) | no |

LOW is the lowest level and qualifies, so it is chosen. The two extra runs per pair were made at LOW, as the plan specifies.

Settings applied to `MODELS.fit` in `server/src/config/models.ts`:

| Setting | Before | After | How |
|---------|-------:|------:|-----|
| `thinking` | `LOW` | `LOW` | chosen level |
| `maxOutputTokens` | 8192 | 4096 | twice the largest observed thought+output (646), rounded up to a multiple of 1024, with a floor of 4096 |
| `deadlineMs` | 45000 | 30000 | three times the LOW p90 (4698), rounded up to a multiple of 5000 (15000), with a floor of 30000 |

Neither the 4096 cap nor the 30000 ms deadline was itself tested: the spike ran with 16384 and 60000, and no LOW call came close to either (largest 646 tokens, slowest 7017 ms). They follow from the stated rule, and the margin is about six times on tokens and four times on time.

## Spend

Token totals over run 3: 26509 prompt tokens and 39715 output tokens including thinking. At the intro prices recorded in the research file (US$0.75 and US$3.75 per million tokens), the estimate is **US$0.1688**. It is an estimate from published prices, not a bill. The six refused requests of runs 1 and 2 reported no tokens. Under the plan's limit of one US dollar.

## What the latency leaves for the advice half (Phase 01.1)

At LOW the fit call answers in 3.5 to 4.7 s typically, with the slowest of ten at 7.0 s, against a 15 s target. That leaves roughly 8 s of headroom at the p90 and about 11 s typically. The call spends its time producing about 480 to 650 output tokens (an estimate of roughly 130 to 180 tokens per second from these figures). If the advice half roughly doubles the output, that adds about 4 s, which would still fit inside the target at LOW. Raising thinking to MEDIUM instead would use up the headroom alone (p90 16.9 s), so thinking should stay at LOW unless a later measurement shows the advice needs it. The output cap of 4096 would then need to be re-derived from a measurement of the longer answer. This is an extrapolation, not a measurement.

## Not covered here

Spike items S3 and S4 (profile and PDF models) belong to Phase 01.2. S6 and S8 (quote pass rate on a golden set, injection fixture) belong to Phase 01.1, though this run did record rejected quotes (zero). S5 (bad-key shape) was not run on purpose; the 403 refusals in run 2 were seen by accident. S9 is the billing decision in plan 01-11.
