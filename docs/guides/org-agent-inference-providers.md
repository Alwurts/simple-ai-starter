# Org-agent inference: providers & Cloudflare AI Gateway

How the org agent (`OrgChat` / `OrgSubAgent`) picks its LLM, how to swap the
provider, and how to front it with Cloudflare AI Gateway — all from environment
variables.

## How it works

Both agents resolve their model once in `onStart` via
`resolveOrgChatModel(this.env)`. The decision is a pure function,
`resolveOrgChatModelConfig(env)`, so it is unit-tested without the network.

- **Files of interest:** `packages/agent/src/inference/chat-models.ts` (the
  registry + resolver), `packages/agent/src/org/chat/org-chat.ts:onStart`,
  `.../org-sub-agent.ts:onStart` (call sites), `apps/web/test/inference/chat-models.test.ts`
  (the AC coverage).

The registry is a `Provider` union → a data-only `PROVIDER_BUILD` map → a
`MODEL_OFFERINGS` catalog → one factory, with keys sourced from **env vars**.

## Selecting a provider

Set `ORG_CHAT_PROVIDER` (unset ⇒ `vercel-gateway`), then the matching key.
`ORG_CHAT_MODEL` optionally overrides the model id.

| `ORG_CHAT_PROVIDER` | Key env var | Default model | Input modalities | Notes |
| --- | --- | --- | --- | --- |
| `vercel-gateway` (default) | `AI_GATEWAY_API_KEY` | `google/gemini-3-flash` | text + image | Vercel AI Gateway; unchanged behaviour |
| `zai-coding-plan` | `ZAI_API_KEY` | `glm-5.2` | **text-only** | z.ai GLM coding plan (OpenAI-compatible); attach control is hidden |
| `workers-ai` | `WORKERS_AI_API_TOKEN` + `CF_ACCOUNT_ID` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **text-only** | Cloudflare Workers AI via its OpenAI-compatible endpoint — **no `env.AI` binding**, so it runs under plain `wrangler dev` |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_BASE_URL` | none — `ORG_CHAT_MODEL` is **required** | per catalog row | Any OpenAI-compatible endpoint; called directly (no CF AI Gateway rewrite) |

Modalities are a **per-model** property on each `MODEL_OFFERINGS` row (`inputModalities`),
not a provider-wide flag — the same provider can host both text-only and vision models.
An unknown `ORG_CHAT_MODEL` override defaults to text-only (conservative, same spirit as
`DEFAULT_CONTEXT_WINDOW`).

Adding a model or provider is a data edit: extend `OrgChatProvider`, `PROVIDER_BUILD`,
and `MODEL_OFFERINGS` (include `inputModalities` on every row).

Attachment gating: `gateChatAttachments` + `GET /api/protected/chat/capabilities`
hide or reject non-text parts for text-only models before the model call, so users never
see opaque provider errors like `messages.content.type is invalid`.

## Generic OpenAI-compatible endpoints (`openai-compatible`)

For any OpenAI-compatible endpoint (self-hosted gateways, aggregators, etc.):

```ini
ORG_CHAT_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1
OPENAI_COMPATIBLE_API_KEY=...
ORG_CHAT_MODEL=vendor/model-id
```

- `ORG_CHAT_MODEL` is **required** — the provider has no default model.
- The base URL is called directly. The Cloudflare AI Gateway section below does
  **not** apply: a gateway route needs a fixed `custom-<slug>` upstream path,
  which an arbitrary origin doesn't have.
- Known model ids get their `MODEL_OFFERINGS` catalog row (e.g.
  `z-ai/glm-5.3-flash`: 1M context, image input); unknown ids fall back to the
  conservative defaults (128k context, text-only).

## Fronting with Cloudflare AI Gateway (optional)

Set **all three** to route the `zai-coding-plan` and `workers-ai` providers
through a Cloudflare AI Gateway (caching, analytics, rate-limiting, retries):

```ini
CF_ACCOUNT_ID=...
CF_AIG_GATEWAY_ID=...      # the gateway slug
CF_AIG_TOKEN=...           # sent as the cf-aig-authorization header
```

When set, the provider's base URL is rewritten to the gateway endpoint and the
gateway token is attached as `cf-aig-authorization`; the upstream provider key
still travels as `Authorization`. When any are missing, the provider calls its
origin directly. `vercel-gateway` is not fronted (Vercel's gateway already gives
observability — double-gatewaying is redundant).

### One-time setup for a third-party upstream (e.g. GLM)

Cloudflare AI Gateway fronts a non-native upstream via a **Custom Provider**.
Create it once in the CF dashboard or API:

- **slug:** `zai` (the code expects `custom-zai/…`)
- **base_url:** `https://api.z.ai`

The gateway then serves it at
`https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/custom-zai/api/coding/paas/v4/chat/completions`.
Workers AI is native (`custom-` not needed): the code targets the `workers-ai`
provider path automatically.

## Local dev & testing

Every provider is an explicit HTTPS call with an env key, so all run under
`wrangler dev` — including Workers AI (via its OpenAI-compat endpoint, not the
`env.AI` binding). Keys live in `.dev.vars` (see `.dev.vars.example`); in
production set them with `wrangler secret put <NAME>`. Automated tests assert the
resolved config; they never call a model.
