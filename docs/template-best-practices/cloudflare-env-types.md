# Cloudflare env types via `cf-typegen`

**Do not hand-edit** `packages/env/src/env.d.ts`. That file is generated from `apps/web/wrangler.jsonc`.

## When to run it

Run `cf-typegen` whenever you change Worker bindings in `wrangler.jsonc`:

- D1, KV, Durable Objects, Workflows
- `vars` (non-secret config declared in wrangler)

From the monorepo root:

```bash
pnpm --filter web cf-typegen
```

Or from the app:

```bash
cd apps/web && pnpm cf-typegen
```

## What it produces

The script runs three steps (defined in `apps/web/package.json`):

1. **`wrangler types`** — writes full runtime types to `apps/web/worker-configuration.d.ts` (app-local, includes typed DO class imports).
2. **`wrangler types ../../packages/env/src/env.d.ts --include-runtime=false`** — writes a portable env-only stub into `@workspace/env` for shared packages (`db`, `auth`, `core`, etc.).
3. **`packages/env/scripts/postprocess-env.mjs`** — strips artifacts that break cross-package type-checking:
   - `interface GlobalProps` (references the worker entry module)
   - `DurableObjectNamespace<import("...")>` → bare `DurableObjectNamespace`
   - Parameterized `Workflow<...>` → bare `Workflow` (when Workflows bindings exist)

## Rules

| Do | Don't |
|----|-------|
| Add or change bindings in `wrangler.jsonc`, then run `cf-typegen` | Edit `packages/env/src/env.d.ts` by hand |
| Commit the generated files after binding changes | Duplicate env types in package source files |
| Extend `postprocess-env.mjs` if wrangler adds new cross-package leakage | Revert to inline `node -e` snippets in `package.json` |

If postprocess needs a new strip rule, add it to `postprocess-env.mjs` with a short comment.

## Two-file model

| File | Consumers | Contents |
|------|-----------|----------|
| `apps/web/worker-configuration.d.ts` | App (`web`) only | Full runtime types + typed DO namespaces |
| `packages/env/src/env.d.ts` | Shared packages via tsconfig `include` | Portable `Cloudflare.Env` bindings only |

Shared packages import `env` from `cloudflare:workers` and rely on the shared `Cloudflare.Env` ambient types. The app gets stronger typing from its local worker config.

## Secrets and `.dev.vars`

**Do not add secrets to `wrangler.jsonc` `vars`.** Declare them in `apps/web/.dev.vars` (see `.dev.vars.example`). Wrangler loads `.dev.vars` automatically during local dev; production values are set with `wrangler secret put <NAME>`.

After adding or changing variables in `.dev.vars`, regenerate types:

```bash
pnpm --filter web cf-typegen
```

`wrangler types` reads bindings from `wrangler.jsonc` and picks up secret names from `.dev.vars` so shared packages (`auth`, `email`, etc.) get typed `env.*` accessors in `packages/env/src/env.d.ts`.

## Related docs

- [ADR-003: Shared Cloudflare Env Types & Direct Singleton Pattern](../decisions/003-cloudflare-env-and-db-singleton.md) — the decision behind `@workspace/env` and the singleton pattern
