# simple-ai starter

A full-stack Cloudflare app where every organization gets its own AI agent.
The chat UI is simple-ai's [`chat-page`](https://www.simple-ai.dev) wired to a
[Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) Durable
Object, and `products` is the example domain you rename into yours. Built for
developers and their coding agents building an AI-first app.

Someone who wants this turned into their own app should be asked what to
change before anything is edited. Agents: read
[`docs/starting-questions.md`](docs/starting-questions.md) first.

![simple-ai starter chat](docs/assets/chat.png)

## Getting started

Use this template on GitHub, or clone it:

```bash
git clone https://github.com/Alwurts/simple-ai-starter.git
cd simple-ai-starter
pnpm install
```

You need Node 22+ and pnpm 11+ (this repo pins `packageManager:
pnpm@11.5.2`; run `corepack enable` if needed).

Copy the example env file and set a `BETTER_AUTH_SECRET` (see
[Better Auth's installation docs](https://www.better-auth.com/docs/installation)
for help generating one):

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

The org agent needs one inference provider. The default is
[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) through
the `AI` binding (`wrangler login` for local dev; no API token). It uses
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` unless `ORG_CHAT_MODEL` says
otherwise. Alternatives: Vercel AI Gateway
(`ORG_CHAT_PROVIDER=vercel-ai-gateway` + `AI_GATEWAY_API_KEY` +
`ORG_CHAT_MODEL`) or any OpenAI-compatible endpoint
(`ORG_CHAT_PROVIDER=openai-compatible` + `OPENAI_COMPATIBLE_BASE_URL` +
`OPENAI_COMPATIBLE_API_KEY` + `ORG_CHAT_MODEL`) — see
[`docs/guides/org-agent-inference-providers.md`](docs/guides/org-agent-inference-providers.md).
Sign-in works without a provider; chat does not.

Migrate the local database and start the app:

```bash
pnpm db:migrate
pnpm dev
```

Open http://localhost:4011, sign up, and create an organization. Want sample
data instead? `pnpm db:seed` seeds a demo user, demo org, and a few example
products into the local database (local only).

## What's included

- **Auth + organizations** — [Better Auth](https://www.better-auth.com/) with
  the organization plugin: sign-up/sign-in, invitations, members, org switcher.
- **The `products` example slice** — one table walked through every layer:
  catalog UI, Hono API, and the agent's five product tools. Rename it into
  your domain.
- **The org agent** — one Durable Object per organization, chat over your
  data with saved chats, org memory, a shared org workspace, a `delegate`
  sub-agent, tool approvals, context compaction, conversation search, one
  bundled skill, an opt-in fetch tool (`FETCH_ALLOWED_HOSTS`), and sandboxed
  code execution (`execute` via the `LOADER` binding; approval-gated tools
  pause inside the sandbox).
- **An end-to-end type-safe stack** with no code generation, from the database
  to the UI.

How the agent is put together — and how to add your own tools:
[`docs/guides/writing-agent-tools.md`](docs/guides/writing-agent-tools.md).

## Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [TanStack Start](https://tanstack.com/start), full-stack React |
| **Agent** | [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) + [@cloudflare/think](https://developers.cloudflare.com/agents/api-reference/think/), one Durable Object per org |
| **Chat UI** | simple-ai [`chat-page`](https://www.simple-ai.dev) |
| **API** | [Hono](https://hono.dev/) RPC, type-safe from route to client |
| **Database** | [Drizzle ORM](https://orm.drizzle.team/) + [Cloudflare D1](https://developers.cloudflare.com/d1/) |
| **Auth** | [Better Auth](https://www.better-auth.com/) with the organization plugin |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai/) |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) + [Base UI](https://base-ui.com/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Email** | [Resend](https://resend.com/) + [React Email](https://react.email/) |
| **Tooling** | Turbo, pnpm, Biome, TypeScript |
| **Deployment** | Cloudflare Workers via Wrangler |

## Project layout

A pnpm + Turbo monorepo, layer-sliced and feature-keyed: `apps/web` plus
packages such as `db`, `contract`, `core`, `agent`, and `ui`. A capability is
the same key `<cap>` repeated across layers — find one slice and you know
where the rest live. The full map and a worked example:
[`docs/architecture.md`](docs/architecture.md).

## Deploy

Deploying needs Cloudflare resources first:

1. A **Workers Paid** plan: the code-execution sandbox (`execute`) runs on
   [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/) through
   the `worker_loaders` binding, which is Paid-only. The org agent's
   SQLite-backed Durable Objects also run on the Free plan.
2. `wrangler d1 create simple-ai-starter`, then paste the id into
   `apps/web/wrangler.jsonc` (`database_id` is
   `placeholder-replace-before-deploy` until you do).
3. Set the Worker secrets (`wrangler secret put`). **Required:**
   `BETTER_AUTH_SECRET`. Workers AI (the default) uses the `AI` binding — no
   extra secret. Vercel AI Gateway needs `AI_GATEWAY_API_KEY` +
   `ORG_CHAT_MODEL`. OpenAI-compatible needs `OPENAI_COMPATIBLE_BASE_URL` +
   `OPENAI_COMPATIBLE_API_KEY` + `ORG_CHAT_MODEL`.
   **Optional:** `ORG_CHAT_PROVIDER` / `ORG_CHAT_MODEL` (defaults: workers-ai /
   `@cf/meta/llama-3.3-70b-instruct-fp8-fast`), `ORG_CHAT_IMAGE_INPUT`,
   `ORG_CHAT_CONTEXT_WINDOW`, `BETTER_AUTH_URL` (set it to your public
   URL), `RESEND_API_KEY` + `EMAIL_SENDER` + `MOCK_SEND_EMAIL` (only to send
   real email). Absent secrets simply leave that feature off; nothing fails at
   deploy time.
4. Migrate the remote database: `pnpm db:migrate:prod`.
5. Build and deploy: `pnpm --filter web deploy`.

**Rate limiting.** Better Auth's built-in limiter counts in per-isolate
memory, which on Workers means every isolate has its own counters — effective
limits end up multiplied across isolates. Before exposing sign-up publicly,
add a Cloudflare [rate-limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/)
on `/api/auth/*` (for example 10 requests / 10 minutes per IP on the
sign-up, sign-in and reset-password endpoints); no application code involved.

Deploys can also run from GitHub Actions —
`.github/workflows/deploy.yml` is manual (`workflow_dispatch`, `main` only)
and never runs on push. The job targets the `production` GitHub environment:
after creating the repo's environments, add **required reviewers** on
`production` in the GitHub settings (Settings → Environments → production →
Required reviewers) so every deploy needs an approval; that protection is
owner-managed in GitHub, not in this repo.

## Tests

- `pnpm verify` — lint, typecheck, unit tests, build (the pre-push hook runs
  it). CI runs the same checks plus the e2e job.
- `pnpm --filter web test:e2e` — Playwright drives a full chat turn against a
  local fake model server on its own port and state.

## Where to go next

- [`docs/starting-questions.md`](docs/starting-questions.md): the questions to
  ask before turning this template into someone's app.
- [`AGENTS.md`](AGENTS.md): commands and conventions once you are working in
  the repo.
- [`docs/architecture.md`](docs/architecture.md): the layer map and a worked
  feature example.
- [`docs/guides/`](docs/guides/): code-anchored how-tos.
- [`docs/decisions/`](docs/decisions/): the architecture decision records.

## License

[MIT](LICENSE).
