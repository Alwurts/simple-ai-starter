# Architecture

The one map of how this template is put together: the layers, how a feature
moves through them, and the rules that keep the boundaries honest. Read this
first — every ADR in `docs/decisions/` records *why* one of these choices was
made, and every guide in `docs/guides/` shows *how* to work within them.

The starter is an org-scoped chat app with one worked example table.
**Chat / Catalog / Settings** is the live information architecture
(`apps/web/src/components/layout/platform-navigation.ts`). The chat is the
signed-in home (`apps/web/src/components/chat/chat-page.tsx`, the simple-ai
`chat-page` block wired to the org's `OrgChat` Think agent). `products` is the
example capability that walks every layer — table → `contract` schema →
`core` functions → Hono route → one list/detail page → five agent tools.

## Guiding principles

- **Legible over optimal.** A new reader — human or AI agent — should be able to
  predict where a thing lives without searching. We trade a little ceremony for
  a layout you can guess.
- **Layer-sliced, feature-keyed.** A fixed, small set of layers. A capability is
  the same key (`<cap>`) appearing in each layer. Adding a feature means adding
  one more slice, not inventing a new structure.
- **One source of truth per fact, at its natural home.** The database owns row
  shapes; the boundary owns input shapes; the typechecker carries them outward.
  Nothing is hand-copied between layers.
- **Boundaries enforced by construction.** The dependency graph makes an
  illegal cross-layer import fail on its own — not because a reviewer noticed.
- **Multi-surface by default.** UI, HTTP API, and AI tools are all just
  surfaces over the same `core`. `core` never imports a framework.

## The layers

A capability flows top-to-bottom; dependencies only ever point *down* this list.

| Layer | Home | Owns |
|---|---|---|
| **db** | `packages/db` | Drizzle schema (one file per capability) + the `db` client singleton. Leaf — no workspace deps. Row types via `$infer`. |
| **contract** | `packages/contract` | Pure boundary Zod for **inbound** inputs/commands only, feature-keyed (`contract/src/<cap>/`). Leaf — no workspace deps. Input types via `z.infer`. Outbound shapes are never declared here (ADR-004). |
| **core** | `packages/core` | Queries + domain logic, feature-keyed (`core/src/<cap>/`), plus `errors.ts` + `pagination.ts`. Framework-agnostic. Depends on `db` + `contract`. |
| **surfaces** | `apps/web/src/...` | The ways `core` is exposed: Hono HTTP (`api/<auth-scope>/<cap>/`), AI Durable Objects, jobs. |
| **agent** | `packages/agent` | Named tool-parts (`tool-parts/<cap>/`: `xName` / `xDescription` / `xInputSchema` / `xExecute`) + DO classes (bound in `apps/web`). Each surface composes the pieces itself and may wrap `execute` differently — `in-app/` today; `mcp/` is reserved. The one *packaged* surface. |
| **ui** | `packages/ui` | Primitives / design-system only (`components/{shadcn,brand,data-table}/`). Leaf — no workspace deps. |
| **components** | `apps/web/src/components/<cap>/` | Feature/composite components — built in-app from `ui` primitives; anything router- or app-aware lives here, not in `ui`. |

Cross-cutting homes: auth = `packages/auth`; typed env = `packages/env`;
structured ops logging = `packages/log` (`@workspace/log`, zero-dep leaf — not a `core` facet);
shared TS config = `packages/tsconfig`. Everything uses the generic
`@workspace/*` scope.

### Cross-layer feature-key consistency

The single most important rule: **a capability uses the same key in every
layer.** `db` keeps it to one file; the other layers give it a folder. So the
`catalog` (products) capability is *exactly*:

```
packages/db/src/schema/catalog.ts            # one schema file
packages/contract/src/catalog/               # boundary zod for inputs
packages/core/src/catalog/                   # queries + domain logic
apps/web/src/api/org-protected/catalog/      # HTTP surface (auth-scoped)
packages/agent/src/tool-parts/catalog/products.ts  # AI tool-parts (each surface composes its own binder)
apps/web/src/components/catalog/             # feature components
```

Find one slice and you know where the other five live. Adding a feature is
dropping one `<cap>` slice into each layer.

## Worked example: a read and a write through `products`

**Write — "create a product" (inbound):**

1. `contract/catalog/` defines `createProductSchema` (Zod) — the *single*
   definition of valid input. It is shared as a runtime **value** by the HTTP
   route, the AI tool, and the client-side form.
2. `core/catalog/createProduct(input)` takes `input: z.infer<typeof
   createProductSchema>` — no hand-synced param type — and writes via the `db`
   singleton.
3. `apps/web/src/api/org-protected/catalog/` validates the request body with
   `createProductSchema` and calls `core`. The same schema powers the React
   form and the `create_product` AI tool.

**Read — "list products" (outbound):**

1. `core/catalog/getProducts(orgId)` queries `db`; its return type is just
   `Awaited<ReturnType<typeof getProducts>>` — inferred from the
   implementation, never restated.
2. The Hono route returns it; the typed Hono RPC client gives the UI the shape
   via `InferResponseType`. React Query hooks consume that.

Nothing in this path re-declares the product shape. Inputs are *defined* once
in `contract`; outputs are *inferred* once from `core`.

## Two schema sources, by direction

This template deliberately keeps **two independent type sources** and does **not**
derive one from the other (no `drizzle-zod`). See **ADR-004** for the full
rationale and the reversal it records.

- **db (drizzle)** → row/persistence types via `$infer`. The shape of stored data.
- **contract (zod)** → boundary input types via `z.infer`. The shape of accepted commands.

They answer different questions and are allowed to differ (a create command is
not a row). Drift between them is caught by **per-capability round-trip tests**,
not by a compile-time derivation chain. Direction split (**ADR-004**, D3):

- **Inbound** (inputs/commands): explicit Zod in `contract`, shared as runtime
  values across API / AI tools / client forms; `core` params are
  `z.infer<contract>`.
- **Outbound** (reads): **inferred** from the implementation — the typed Hono
  client (`InferResponseType`) for clients, `Awaited<ReturnType>` for the server.
- **Timestamps are ISO `text` end-to-end** for domain tables (Better-Auth's
  `Date` columns are an accepted internal-only exception). Money is an integer
  minor-unit column (integer cents; never floats).
- Types are identified by **import location + suffix** — no `Db*` prefix.

## Surfaces: one Worker app

`apps/web` is a single Cloudflare Worker that hosts **every** surface — the
TanStack Start UI, the Hono API (organized `auth-scope → feature`), the AI
Durable Objects, and background jobs. A new app is justified only when the
runtime genuinely differs, not when a new surface is added. This keeps one
deploy, one binding set, one env. See **ADR-001**.

## The HTTP API

`apps/web/src/api/` is a Hono app mounted at `/api` (`server.ts`). It is
grouped by **auth scope first, then capability** — the scope is a folder, never
a URL segment:

```
api/index.ts                       onError + error shape, /auth/*, then mounts
                                   scopes in fixed order: public → protected → org-protected
api/middleware/{session,organization,error-handler}.ts
api/public/<resource>.ts           no session needed (extractAuth only)
api/protected/<resource>.ts        a valid session (requireAuth)
api/org-protected/<cap>/*.ts       a live membership in the active org
                                   (requireAuth + requireActiveOrg)
```

Each scope's `index.ts` composes its resources through a guard wrapper —
`withAuth(chatRoutes)`, `withOrgAccess(catalogRoutes)` — so the guard is
`use("*")` on a sub-app that only exists at the resource prefix it is mounted
under: anything a scope mounts is guarded by construction, no path string is
repeated, and the `"*"` cannot leak to sibling scopes (mounting prefixes it).
Route files never repeat guards. `extractAuth` is the one deliberate global
(the public scope's first line): it only reads the session and gates nothing,
so each API call resolves the session exactly once.

**Resources live in the URLs; scopes don't.** Today's routes: `GET /api/health`,
`GET /api/chat/capabilities`, and `/api/catalog/products` (`GET` list with
`?search=&page=&pageSize=&sortBy=&sortOrder=`, `GET /:id`, `POST` → **201** with
the created row, `PATCH /:id` partial update, `DELETE /:id` → **204** no body).
`GET /:id` 404s when the row is missing or belongs to another org. A scope with
more than one resource is a folder; a single-resource scope is one file.

**Every non-2xx response has one shape** — `{ error: { code, message, issues? } }`
— built in `api/middleware/error-handler.ts` (`/api/auth/*` keeps Better
Auth's own error bodies): `HTTPException` (401/403),
`DomainError` (`not_found` / `conflict` / `unprocessable` → 404/409/422),
validation failures (`code: "validation"`, 400, readable message + zod issues),
unknown routes (`notFound`), and the 500 fallback. The typed Hono RPC client
(`hc<AppType>`) carries response types end-to-end: hooks call
`client.catalog.products.$get()` and narrow with `res.ok` /
`InferResponseType`.

## apps/web layout

Inside `apps/web/src`, code is organized **by kind, then by feature** — one
place per kind, sub-folders per feature, mirroring the same feature keys:

- **`routes/`** — TanStack Router file routes, **thin**: a route file holds
  route config only (`beforeLoad`, `validateSearch`, `loader`, `head`,
  `errorComponent` wiring) and renders **one** page component from
  `components/<feature>/<name>-page.tsx`. A section with its own layout or
  more than one page is a folder with a pathless layout route; a single page
  is a flat file.
- **`components/<feature>/`** — all of a feature's components (chat also
  groups by category: `chat/{messages,input,side-panel,connection}/`).
- **`hooks/<feature>/`**, **`lib/<feature>/`** — hooks and helpers per
  feature; app-wide ones sit at the root of `hooks/` and `lib/` (the API
  client `lib/client.ts`, the query client `lib/query.ts`, `lib/locale.ts`).
- **`test/{api,core,agent,e2e}/`** — binding tests (`*.workerd.test.ts`) and
  e2e; shared helpers at `test/` root. Unit tests (`*.test.ts`) sit **next to
  the file they test**.

```
apps/web/src/
  routes/
    __root.tsx
    _auth.tsx                        auth card layout; bounces signed-in users
    _auth/{login,signup,forgot-password,reset-password}.tsx
    _protected.tsx                   session required → /login?redirect=…
    _protected/{onboarding,accept-invitation.$id}.tsx
    _protected/_org.tsx              active org required (→ /onboarding); Shell
    _protected/_org/index.tsx        "/" → most recent chat or /chat/new
    _protected/_org/chat/{new,$chatId}.tsx
    _protected/_org/catalog/{index,$id}.tsx
    _protected/_org/settings/{route,index,general,members}.tsx
  components/{chat,catalog,organization,auth,layout,search,common,providers}/
  hooks/{chat,catalog,organization}/…
  lib/{chat,catalog,organization}/…, lib/{client,query,locale}.ts
  api/                               HTTP surface (auth-scope → feature; scope
                                     = folder, resources = URLs)
  server.ts, router.tsx
apps/web/test/{api,core,agent,e2e}/
```

Conventions: kebab-case files named after their main export
(`chat-page.tsx` → `ChatPage`); **named exports only** (default only where a
framework demands it — the Worker entries); one exported component per file
(small private helpers OK); no barrel `index.ts` files inside `apps/web/src` —
each `api/<scope>/index.ts` is the exception that isn't one: it **composes**
(the guard + `.route()` mounting), it never re-exports.

## packages/ui taxonomy

`packages/ui/src/components/` has three folders, pinned by
`packages/ui/test/taxonomy.test.ts`:

- **`shadcn/`** — exactly what `shadcn add` produced (including the
  `@simple-ai` registry items), never hand-edited. Re-add a file with the
  pinned CLI instead of editing it.
- **`brand/`** — how we look. The test: *would a rebrand change this file?*
  Today: `shell.tsx`, the logo (`logo-monochrome.tsx`), and the auth page.
- **`data-table/`** — generic, look-less table composites (`data-table`,
  `resource-table`, `sortable-header`, the filter-toolbar chips,
  `table-filter-types`, `data-table-features`).

**shadcn provenance & drift.** The stock files come from the
[`base-vega`](https://ui.shadcn.com) style via the registries in
`components.json` — shadcn's own (`button`, `card`, …) plus `@simple-ai`
(`https://www.simple-ai.dev/r/{name}.json`) for the chat block — installed
with the CLI pinned as a devDependency of `packages/ui` (`shadcn@4.20.1`,
config in `packages/ui/components.json`). To check a component for drift
against its registry item, run the CLI's diff manually:

```bash
pnpm --filter @workspace/ui exec shadcn add <component> --diff
```

A non-empty diff means the file was hand-edited or the registry moved —
re-add with `--overwrite` (or update the pin) instead of patching by hand.

Anything router- or app-aware is **not** in `packages/ui`: e.g. breadcrumbs
live in `apps/web/src/components/layout/` because they render router `Link`s.
`packages/ui` has no workspace dependencies and imports no router.

## Naming (role over technology)

Packages and apps are named for the **role they play**, not the library that
implements them — so the layout survives a library swap. Scope stays
`@workspace/*`. The names in use are `apps/web`, `packages/db`,
`packages/contract`, `packages/env`, and `packages/tsconfig`. Boundary input
types live in `contract`; row types come from `db` `$infer` — see **ADR-004**.

## Mechanical boundaries

The layer rules are enforced *by construction*, not by review (**ADR-001**, D8):
**enforcement is the `package.json` dependency graph under pnpm's strict,
isolated node_modules** — each package lists only its allowed deps, so an
illegal import simply doesn't resolve:

- `db`, `contract`, `log`, `ui` are leaves (no workspace deps).
- `core` = `db` + `contract`; `auth` = `db` + `email`.
- `agent` = `auth` + `contract` + `core` + `log`.
- `apps/web` = `agent` + `auth` + `core` + `contract` + `log` + `ui`.
  (`@workspace/db` stays a **devDependency**: only the workerd tests seed and
  query D1 directly; `apps/web/src` never imports it.)

We deliberately skip TypeScript project-references, a custom ESLint boundary
plugin, and a runtime import guard — the dep graph already makes the wrong
thing fail.

## The database & env singletons

`db` exports a singleton built from `import { env } from "cloudflare:workers"` —
any layer does `import { db } from "@workspace/db"` with no wiring file. Typed
env lives in `packages/env`, auto-generated from `wrangler.jsonc`. `core` is
Workers-runtime code, tested with the workerd test pool. Migrations live in
`packages/db/drizzle/`. See **ADR-002** (migrations) and **ADR-003** (env +
singleton).

Tests split by where they must run: a plain `*.test.ts` is a pure unit
test run in the fast `node` Vitest project, while anything that needs a binding —
`env.DB`/`SELF`, or a Durable Object — is named `*.workerd.test.ts` and runs
in-workerd via `@cloudflare/vitest-pool-workers` against `wrangler.test.jsonc`.
The DO fixture + reference tests live in `apps/web/test/agent/`. Browser
e2e (`pnpm --filter web test:e2e`) drives a full chat turn against a local fake
model server in CI.

## Where to go next

- **The agent** — the org agent's tools, memory, workspace, sub-agent and
  approvals → [`docs/guides/writing-agent-tools.md`](guides/writing-agent-tools.md).
  Agent features beyond the product tools: cross-chat conversation search
  (`OrgAgent.searchChats` over each chat's Sessions FTS index), Agent Skills
  (bundled `agents:skills` on `OrgChat` only), the opt-in read-only fetch tool
  (`FETCH_ALLOWED_HOSTS`, absent when empty), and sandboxed code execution via
  `@cloudflare/codemode` (`execute` tool, `LOADER` binding; gated writes pause
  inside the sandbox — see
  [`docs/guides/agent-tool-approvals.md`](guides/agent-tool-approvals.md)).
- **Why** a choice was made → `docs/decisions/` (ADRs, under a strict
  significance bar — see ADR-005).
- **How** to do or extend something here → `docs/guides/`.
- **Procedural domain knowledge** an agent loads on demand → `.agents/skills/`.
- **Commands + conventions + the index into all of the above** → `AGENTS.md`.
