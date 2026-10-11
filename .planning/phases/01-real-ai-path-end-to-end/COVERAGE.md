# API Coverage — Google Gemini API (`@google/genai` 2.28.0)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Scope: Phase 1 (rated fit check on pasted text). Sources: `01-RESEARCH.md` Part A, `01-CONTEXT.md` "Scope After the Split", D-01 to D-04.

| capability | decision | reason |
|---|---|---|
| generate-content-structured-json | INTEGRATE | |
| system-instruction | INTEGRATE | |
| thinking-level | INTEGRATE | |
| max-output-tokens | INTEGRATE | |
| abort-signal-and-timeout | INTEGRATE | |
| base-url-override | INTEGRATE | |
| usage-metadata | INTEGRATE | |
| finish-reason-and-block-feedback | INTEGRATE | |
| api-error-status | INTEGRATE | |
| inline-pdf-input | OPT-OUT | not needed in Phase 1 — PDF reading and the consent-first fallback are Phase 01.2 (D-09, D-09a) |
| plain-text-generation | OPT-OUT | not needed in Phase 1 — only the PDF transcription in Phase 01.2 wants unstructured text |
| generate-content-stream | OPT-OUT | not needed yet — streaming chat is Phase 6 |
| interactions-api | OPT-OUT | explicitly out of scope — Beta, and it stores every interaction for 55 days by default, which breaks the stateless-server rule |
| files-api | OPT-OUT | explicitly out of scope — uploaded files stay at Google for 48 hours; inline data keeps the server stateless |
| tools | OPT-OUT | explicitly out of scope — no search, URL context, function calling or code execution, so injected text cannot cause side effects |
| sdk-retry-options | OPT-OUT | not wanted — every retry is a paid call; the user's "Try again" is the retry |
| sampling-parameters | OPT-OUT | not usable — temperature, topP, topK, seed and candidateCount are deprecated and ignored on the 3.6 and 3.8 generation and will be rejected later |
| safety-settings | OPT-OUT | not needed — default thresholds are off for these models; blocks are still detected through finish reason and prompt feedback |
| context-caching | OPT-OUT | not needed — one short call per fit check; caching would also keep content at the provider |
| token-counting | OPT-OUT | not needed — usage metadata on the response is enough for the spike |
| embeddings | OPT-OUT | not needed — no retrieval or similarity search in this product |
| batch-api | OPT-OUT | not needed — fit checks are interactive, one at a time |
| live-api | OPT-OUT | not needed — no real-time audio or video |
| image-audio-video-generation | OPT-OUT | not needed — text analysis only |
| model-listing-and-tuning | OPT-OUT | not needed — the model id is fixed in `server/src/config/models.ts` (D-04) |
| vertex-ai-mode | OPT-OUT | explicitly out of scope — the key is a Gemini Developer API key (D-01) |
