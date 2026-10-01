# Org-agent inference: providers

How the org agent (`OrgChat` / `OrgSubAgent`) picks its LLM and how to swap
the provider — all from environment variables.

## How it works

Both agents resolve their model once in `onStart` via
`resolveOrgChatModel(this.env)`. The decision is a pure function,
`resolveOrgChatModelConfig(env)`, so it is unit-tested without the network.

- **Files of interest:** `packages/agent/src/inference/chat-models.ts` (the
  registry + resolver), `packages/agent/src/org/chat/org-chat.ts:onStart`,
  `.../org-sub-agent.ts:onStart` (call sites), `apps/web/test/agent/chat-models.test.ts`
  (the AC coverage).

The registry is a `Provider` union → a data-only build map → a
`MODEL_OFFERINGS` catalog → one factory, with keys sourced from **env vars**.

## Selecting a provider

Set `ORG_CHAT_PROVIDER` (unset ⇒ `workers-ai`, the default), then the
matching key. `ORG_CHAT_MODEL` optionally overrides the model id.

| `ORG_CHAT_PROVIDER` | Key env vars | Default model | Input modalities | Notes |
| --- | --- | --- | --- | --- |
| `workers-ai` (default) | `CF_ACCOUNT_ID` + `WORKERS_AI_API_TOKEN` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **text-only** | Cloudflare Workers AI via its OpenAI-compatible endpoint — **no `env.AI` binding**, so it runs under plain `wrangler dev` |
| `openai-compatible` | `OPENAI_COMPATIBLE_BASE_URL` + `OPENAI_COMPATIBLE_API_KEY` | none — `ORG_CHAT_MODEL` is **required** | per catalog row | Any OpenAI-compatible endpoint, called directly |

Modalities are a **per-model** property on each `MODEL_OFFERINGS` row
(`inputModalities`), not a provider-wide flag — the same provider can host
both text-only and vision models. An unknown `ORG_CHAT_MODEL` override
defaults to text-only (conservative, same spirit as `DEFAULT_CONTEXT_WINDOW`).

Adding a model or provider is a data edit: extend `OrgChatProvider`,
`PROVIDER_BUILD`, and `MODEL_OFFERINGS` (include `inputModalities` on every
row).

Attachment gating: `gateChatAttachments` + `GET /api/chat/capabilities`
hide or reject non-text parts for text-only models before the model call, so
users never see opaque provider errors like `messages.content.type is invalid`.

## Generic OpenAI-compatible endpoints (`openai-compatible`)

For any OpenAI-compatible endpoint (aggregators, self-hosted gateways, etc.):

```ini
ORG_CHAT_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1
OPENAI_COMPATIBLE_API_KEY=...
ORG_CHAT_MODEL=vendor/model-id
```

- `ORG_CHAT_MODEL` is **required** — the provider has no default model.
- Known model ids get their `MODEL_OFFERINGS` catalog row (e.g.
  `z-ai/glm-5.3-flash`: 1M context, image input); unknown ids fall back to the
  conservative defaults (128k context, text-only).

## Local dev & testing

Every provider is an explicit HTTPS call with an env key, so both run under
`wrangler dev`. Keys live in `.dev.vars` (see `.dev.vars.example`); in
production set them with `wrangler secret put <NAME>`. Automated tests assert
the resolved config; they never call a model. The e2e suite points the
`openai-compatible` provider at a local fake model server
(`apps/web/test/e2e/fake-model-server.mjs` via `.dev.vars.e2e`), so a full
chat turn runs with no real key.
