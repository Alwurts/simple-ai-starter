# AGENTS.md

Tier-1 entry point for anyone — human or AI agent — working in this repo. It
carries **commands + conventions + the index into everything else**, and nothing
deeper: follow the links for detail.

> `AGENTS.md` and `.claude/CLAUDE.md` are kept **byte-identical** — mirrored as
> real copies, not a symlink, since some tools don't auto-read a symlinked
> instructions file. Change one, copy it over the other.

## Commands

Run from the **monorepo root** (not inside a package):

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Type check | `pnpm typecheck` |
| Format + lint (fix) | `pnpm lint:fix` |
| Lint (check only) | `pnpm lint:check` |
| Tests | `pnpm test` |
| E2E tests | `pnpm --filter web test:e2e` — own port + state, fake model server; runs in CI, not in `pnpm verify` |
| Build | `pnpm build` |
| CI checks except e2e (before you push) | `pnpm verify` |
| Generate a migration | `pnpm db:generate` |
| Apply migrations (local) | `pnpm db:migrate` |
| Reset local DB | `pnpm db:reset` |
| Drizzle Studio | `pnpm db:studio` |
| Regenerate env types | `pnpm cf-typegen` (from the web app) |

## Conventions (the short version)

- **Live IA is the truth:** Chat / Catalog / Settings (`apps/web/src/components/layout/platform-navigation.ts`).
- **Layer-sliced, feature-keyed.** A capability is the same key `<cap>` repeated
  across layers (`db` → `contract` → `core` → surfaces → `ui`/`components`). Find
  one slice, you know where the other five live. → [`docs/architecture.md`](docs/architecture.md)
- **Two schema sources, by direction.** Row types come from `db` (`$infer`); input
  types come from `contract` (hand-written Zod). **No `drizzle-zod` derivation.**
  Inbound is defined once in `contract`; outbound is inferred from `core`. → [ADR-004](docs/decisions/004-schema-sources-and-boundary-types.md)
- **Naming = role over technology** (`db` not `db-d1`, `contract` not `types`,
  `env` not `cloudflare-env`); scope stays `@workspace/*`.
- **Timestamps are ISO `text`** for domain tables; money columns are integer
  minor units (cents).
- **Boundaries are mechanical** — the `package.json` dep graph + the
  `cloudflare:workers`/server-only import guard make illegal cross-layer imports
  fail on their own. Don't add a wiring file; `import { db } from "@workspace/db"`.
- **Generated files are never hand-edited** — `packages/env/src/env.d.ts` and the
  app's `worker-configuration.d.ts` come from `pnpm cf-typegen`.

## Where things live (index)

- **What the system is** → [`docs/architecture.md`](docs/architecture.md) — the
  layer map + a worked `products` slice; the org agent (five product tools,
  memory, shared workspace, `delegate` sub-agent, approvals, compaction,
  conversation search, one bundled skill, opt-in `FETCH_ALLOWED_HOSTS` fetch
  tool, codemode `execute` behind the `LOADER` binding) →
  [`docs/guides/writing-agent-tools.md`](docs/guides/writing-agent-tools.md).
- **Why a choice was made** → [`docs/decisions/`](docs/decisions/) — ADRs, under a
  strict significance bar ([template](docs/decisions/template.md)).
- **How to do/extend something here** → [`docs/guides/`](docs/guides/).
- **Think / Agents SDK APIs** → read the installed docs first —
  `@cloudflare/think/docs/` and `agents/docs/` (under the depending package's
  `node_modules`, e.g. `packages/agent/node_modules/`), plus the packages'
  `dist/*.d.ts` — and prefer their helpers over hand-rolled code.
- **Procedural domain knowledge, loaded on demand** → `.agents/skills/`
  (`wrangler`, `durable-objects`, `workers-best-practices`,
  `agents-sdk`, `ai-sdk`, `shadcn`,
  `template-architecture`, `components-composition`). Use the relevant skill
  when a task matches its domain.
- **Cloudflare skills are hash-pinned in-repo** (`skills-lock.json`) so a
  fresh clone works without `npx skills add --global`. That is a
  template choice. Cloudflare's live [agent-setup
  prompt](https://developers.cloudflare.com/agent-setup/prompt.md) is for a
  personal machine (global skills + account MCP at
  `https://mcp.cloudflare.com/mcp`); do not copy that account server into this
  repo. Committed MCP (`.cursor/mcp.json` / `.mcp.json`): `cloudflare-docs`,
  `cloudflare-bindings`, `cloudflare-observability`.
<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
- **Setup / run** → [`README.md`](README.md).

## Code standards

This project uses **Biome** for formatting and linting. Fix with `pnpm lint:fix`;
verify with `pnpm typecheck` and `pnpm lint:check`. Run from the root. Before
you push, run `pnpm verify`: CI's checks except the e2e job, and the pre-push hook runs it too.

- **Self-descriptive code first** — names and types should carry the *what*; comments
  only for non-inherent *why* (invariants, races, platform quirks, ADR links).
- **No narration** — drop section banners, JSX region labels, name-echo JSDoc, and
  step labels that restate the next line.
- **Prefer refactor over clarifying comments** when the code is unclear (rename /
  extract in a separate change; hygiene passes are REMOVE-only).
- **Keep** invariant / RBAC / security notes, directive suppressions with reasons,
  and schema comments that encode real constraints — see
  [`docs/guides/comment-hygiene.md`](docs/guides/comment-hygiene.md).
