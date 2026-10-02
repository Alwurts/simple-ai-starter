# Org-agent inference: providers

How the org agent (`OrgChat` / `OrgSubAgent`) picks its LLM and how to swap
the provider — all from environment variables.

## How it works

Both agents memoize `resolveOrgChatModel(this.env)` the first time `getModel()`
runs (Think calls it during startup, before the subclass `onStart`). Workers
AI returns a model-id string and Think builds the client. The other two
branches return an AI SDK model.

- **File:** `packages/agent/src/inference/chat-models.ts`
- **Tests:** `apps/web/test/agent/chat-models.test.ts`

## Selecting a provider

Set `ORG_CHAT_PROVIDER` (unset ⇒ `workers-ai`). `ORG_CHAT_MODEL` overrides the
id. `ORG_CHAT_IMAGE_INPUT=true` (or `1`) turns image attachments on; the
default is text-only. `ORG_CHAT_CONTEXT_WINDOW` is an optional positive
integer (default `128000`) that drives compaction.

| `ORG_CHAT_PROVIDER` | What you set | Default model | Notes |
| --- | --- | --- | --- |
| `workers-ai` (default) | `AI` binding in `wrangler.jsonc`. No token. | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | A `@cf/...` id hits Workers AI. Any other `provider/model` slug routes through Cloudflare AI Gateway. Local calls are remote: `wrangler login`. |
| `vercel-ai-gateway` | `AI_GATEWAY_API_KEY` + `ORG_CHAT_MODEL` | none — model is required | `createGateway` from the `ai` package. No extra dependency. |
| `openai-compatible` | `OPENAI_COMPATIBLE_BASE_URL` + `OPENAI_COMPATIBLE_API_KEY` + `ORG_CHAT_MODEL` | none — model is required | Any OpenAI-compatible endpoint, called directly. This is the e2e fake model. |

Attachment gating: `gateChatAttachments` + `GET /api/chat/capabilities` hide
or reject non-text parts before the model call.

## Examples

Workers AI, default model (nothing else required once you are logged in):

```ini
ORG_CHAT_PROVIDER=workers-ai
```

Vercel AI Gateway:

```ini
ORG_CHAT_PROVIDER=vercel-ai-gateway
AI_GATEWAY_API_KEY=...
ORG_CHAT_MODEL=openai/gpt-5.4
```

OpenAI-compatible (the e2e shape, or an aggregator):

```ini
ORG_CHAT_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.example.com/v1
OPENAI_COMPATIBLE_API_KEY=...
ORG_CHAT_MODEL=vendor/model-id
ORG_CHAT_IMAGE_INPUT=true
ORG_CHAT_CONTEXT_WINDOW=1000000
```

## Local dev and testing

Keys live in `.dev.vars` (see `.dev.vars.example`); in production set them
with `wrangler secret put <NAME>`. Tests assert the resolved model and never
call one. The e2e suite points `openai-compatible` at a local fake model
server (`apps/web/test/e2e/fake-model-server.mjs` via `.dev.vars.e2e`).
That run sets `remoteBindings: false` on the Cloudflare Vite plugin, because
the `AI` binding would otherwise open a remote session and CI has no
Cloudflare token.
