# Writing org-agent tools

How to author, compose, and test the snake_case top-level tools the org agent
exposes via Think. Covers layout, context vs parameters, tool *design*
principles, the `ToolResult` fail contract, approval gates, and common gotchas.
This guide and the approval stub (`agent-tool-approvals.md`) cover the same
runtime; the authoring detail lives here.

Design principles below are adapted from Korra's `platform-tool-design`
methodology (agent-facing contract, composability, shape matching); the
implementation details are specific to this starter + Think stack.

## Layout: tool-parts + in-app binder

Tools are **named pieces** (`name` / `description` / `inputSchema` /
`execute(ctx, input)`). Binders stamp identity and wrap the surface. Do not
close over org id inside the catalog, and do not loop a catalog array to
register tools.

```
packages/agent/src/
├── tool-parts/
│   ├── context.ts              # ToolContext (= AgentToolsContext)
│   └── catalog/products.ts     # the five product pieces
├── in-app/
│   ├── in-app-tool.ts          # binder: asToolResult + needsApproval
│   ├── compose-org-tools.ts    # getOrgAgentTools / ReadOnly / Display
│   └── display.ts              # display_* (UI echoes — not tool-parts)
└── tools/
    ├── tool-result.ts          # ToolResult + requireFound + asToolResult
    └── guard.ts                # assertCan RBAC (called from write execute)
```

| Compose entry | What it returns | Where it runs |
|---------------|-----------------|---------------|
| `getOrgAgentTools(ctx)` | The five product tools (`list/get/create/update/delete_product`) | Top-level Think tools on `OrgChat` — **also** the `tools.*` surface inside the codemode sandbox |
| `getOrgAgentReadOnlyTools(ctx)` | `list_products`, `get_product` only | Delegated sub-agent (`OrgSubAgent`) |
| `getOrgAgentDisplayTools(ctx)` | `display_product_list`, `display_memory` | Top-level peers of the product tools + `delegate` |

`org-chat.getTools()` spreads the fetch tool (when allowlisted), the product
tools, `delegate`, and display tools as siblings. Display tools are UI echoes
and may keep their own return shapes — do not block product work on wrapping
them.

The codemode sandbox (`execute` tool, below) is built from
`getOrgAgentTools(ctx)` — nothing else. That is what keeps `update_product` /
`delete_product` approval-gated inside sandbox code, and what keeps `delegate`,
display tools and the browser out of it.

## Agent Skills (`getSkills()`)

`OrgChat.getSkills()` returns the bundled `agents:skills` source, resolved by
the Agents Vite plugin (already in `apps/web/vite.config.ts`) to
`packages/agent/src/org/chat/skills/`. One directory per skill with a
`SKILL.md` (frontmatter `name` + `description`, markdown body); the starter
ships `product-copy` ("write product copy; check the org's shared memory for
tone first"). Think merges the catalog into the system prompt and exposes
`activate_skill` / `read_skill_resource` on **OrgChat only** — `OrgSubAgent`
does not override `getSkills`, so `delegate` never sees them.

Script running stays off: no `getSkillScriptRunner` override, so
`run_skill_script` is never registered — do not add skill `scripts/`
directories. `skillWorkspace` stays off too. Add a skill by dropping a
`skills/<name>/SKILL.md` directory next to `org-chat.ts`; no code changes.

Under vitest, `agents:skills` is a Vite-plugin virtual module the test configs
do not load, so `apps/web/vitest.config.ts` aliases it to an empty-catalog
stub (`apps/web/test/agents-skills-shim.ts`); the SKILL.md itself is pinned by
`skills.test.ts` in packages/agent.

## Fetch tool (`FETCH_ALLOWED_HOSTS`, off by default)

Think's read-only `fetch_url` tool is opt-in per environment: `OrgChat` calls
`createFetchTools({ allowlist })` only when `FETCH_ALLOWED_HOSTS` (a
comma-separated hostname list declared in `wrangler.jsonc` `vars`) parses to
at least one host — empty/unset means the fetch tool does not exist at all
(`packages/agent/src/org/chat/fetch-allowlist.ts`). Each hostname becomes a
bare-origin allowlist entry (origin + every subpath); Think enforces GET-only,
size caps, redirect-into-allowlist, and blocks private/loopback targets.

## Code execution (codemode `execute` tool)

`OrgChat.getTools()` adds `execute` via `createExecuteTool(this, { tools:
productTools })` from `@cloudflare/think/tools/execute`: the model writes
TypeScript that runs in an isolated Worker sandbox. Setup that this template
already has: the `worker_loaders` binding `LOADER` (`wrangler.jsonc`) and
`export { CodemodeRuntime } from "@cloudflare/codemode"` in
`apps/web/src/server.ts` (the manual export the codemode docs prescribe —
equivalent to their Vite plugin's output).

Inside the sandbox the model sees `tools.*` (the five product tools),
`state.*` (the shared org workspace), and the `codemode` SDK — no `cdp.*`
(there is no `BROWSER` binding) and no `delegate`. Sandbox code runs with
network access blocked.

Running code is **not** gated itself (D-015) — approvals come from the gated
tools the code calls: sandbox calls to `update_product` / `delete_product`
keep their `needsApproval`, which the codemode runtime maps to its durable
pause/approve/resume — see
[`agent-tool-approvals.md`](./agent-tool-approvals.md).

A paused run renders an approval card outside the collapsed Worked group
(`PausedExecutionCard` in
`apps/web/src/features/assistant/components/chat-message-parts.tsx`), which
loads the full pending args via `pendingExecutions(executionId)` and resolves
via `approveExecution` / `rejectExecution`; Think replays the run and
auto-continues the chat.

## Context globals vs `inputSchema`

`ToolContext` / `AgentToolsContext`: `{ organizationId, userId, waitUntil }`

| Closed in context | Passed per call (`inputSchema`) |
|-------------------|----------------------------------|
| `organizationId` (every tool) | Product ids / refs, create/update fields |
| `userId` (writes — `assertCan`; tool execute often lacks ALS) | `limit`, filters |
| `waitUntil` | Unused today |

`execute` always receives full `ToolContext`. The read-only binder fills
`userId` with `""` because write pieces are not registered there. Writes call
`assertCan` inside `execute` and need a real `userId`.

## Design before you wrap

Wrapping every `@workspace/core` function one-to-one is almost always wrong:
too many tools, the wrong granularity, and "tools" that are just two other
tools glued together.

**Composability rule:** a tool earns its place only if it grants a capability
the agent **cannot already compose** — an atomic write, an irreducible guard,
or (later) an external/async job. If the candidate is "read X, then write Y"
with nothing lost in between, **don't build it**; teach the sequence in a skill
or system-prompt note instead.

Name the cut:

| Cut | Meaning | Example |
|-----|---------|---------|
| **Composability drop** | Agent can compose it → drop permanently | Hypothetical "create product then list" mega-tool |
| **Scope defer** | Irreducible but not needed for the current goal → defer explicitly | Domains beyond the example table |

**Bundle** only when a sequence is obligatory, has **no intermediate decision**,
and intermediate ids are pure plumbing. Prefer separate tools when the model
must choose or inspect between steps.

Ground every cut in the **real** core function (signature, cascades, sync vs
async) — not assumptions.

## Match shape to the step

Not every domain is CRUD. Pick the shape before naming tools:

| Shape | When | Starter pattern |
|-------|------|-----------------|
| **CRUD + lifecycle** | Draft you author, then lock/delete | `list`/`get`/`create`/`update` + gated `delete_*` |
| **Pure persist** | Config with no cascade | upsert-style write + reads |
| **Approval-gated destructive / hard to undo** | Irreversible or user-owned state | `needsApproval: true` (AI SDK pause) + RBAC in `execute` |
| **No agent tool** | Pure UI flows, or org management (D-006/D-007: no org tools) | Hand off to the real screen |

**Delete as its own verb.** Don't bury a one-way transition in a boolean on a
generic `update` (e.g. `update(..., deleted: true)`). `delete_product` is a
separate approval-gated tool for that reason.

## Result contract + `asToolResult`

Tools return a discriminated union — never throw for expected domain misses:

```ts
type ToolErrorCode =
  | "not_found"
  | "conflict"
  | "forbidden"
  | "unprocessable"
  | "unknown";

type ToolOk<T> = { ok: true; data: T };
type ToolErr = { ok: false; error: string; code: ToolErrorCode };
type ToolResult<T> = ToolOk<T> | ToolErr;
```

`asToolResult(fn)` wraps `execute`:

- `DomainError` → `{ ok: false, error: message, code: map DomainErrorCode }`
- `Error` with `PERMISSION_DENIED_MESSAGE` → `{ ok: false, code: "forbidden" }`
- other `Error` → `{ ok: false, code: "unknown" }`
- success → `{ ok: true, data }`

**Getters:** when core returns `null` / `undefined`, call `requireFound(data, detail)`
inside `execute` — it throws `DomainError("…", "not_found")`, which `asToolResult`
maps to `{ ok: false, code: "not_found", error: detail }`. **Lists:** empty arrays
stay `{ ok: true, data: [] }`.

Prefer `inAppTool` (`in-app/in-app-tool.ts`) to bind a named piece for OrgChat —
it applies `asToolResult` and `toModelOutput` (`error-text` on fail, `json` on
success). Author the piece in `tool-parts/`; do not wrap `tool()` in the catalog.

The system prompt tells the model to check `ok` before using `data`.

**Errors are an interface:** the `error` string is what the model reads to
self-correct. Prefer actionable text with a recovery hint ("Product not found:
no match for id or name …"; "ambiguous product ref: N matches …") over
generic "failed". Surface meaningful `DomainError` messages; don't flatten them.

## Agent-facing contract

At runtime the model sees **name, description, params, output, and `error`** —
not your composability ledger. Design that contract deliberately.

### Naming

- **snake_case**, `verb_object` / `verb_domain_object`
  (`list_products`, `delete_product`).
- Consistent domain prefixes so related tools cluster for selection.
- Keep identifiers stable across prompts and UI (no reliance on
  hyphen→underscore sanitization).

### Descriptions (write them for the model)

In 1–3 sentences cover: **what it does, when to use it, what it returns, what
to do next.** Include what types alone don't say:

- **Units / formats** — money is integer **minor units**; dates ISO if relevant.
- **Chaining hint** — "returns the new product `id`; pass it to `get_product`
  or `update_product`."
- **Preconditions** — "only works on an existing product; ambiguous name →
  `conflict`."
- **Destructiveness** — say so for gated tools ("Requires explicit user
  approval").

### Params

- One-line `.describe()` on non-obvious fields; **enums** over free strings when
  the set is closed.
- **Explicit ids** — no hidden "current product"; pair with `list_*` / `get_*`
  (and ref resolution where we intentionally allow id or exact name).
- Only ask for fields that change (unless the service is full-replace — then say
  so).

### Outputs

- **Lean lists** — enough to *choose* (id, name, …) with limits/filters as
  needed; **fat gets** — enough to *act*.
- Return **chainable ids** from every create/update.
- Same units in as out so values round-trip without conversion.

## `needsApproval` ↔ AI SDK tool approval

On `@cloudflare/think` + the AI SDK tool loop:

- `needsApproval: true` on a top-level tool pauses before `execute` with
  part state `approval-requested`.
- The chat renders Approve/Reject
  (`apps/web/src/features/assistant/components/chat-message-parts.tsx` →
  `addToolApprovalResponse`).
- **Pause happens before `execute`.** After approve, `execute` runs and returns
  `ToolResult` — a miss is a soft `{ ok: false }`, not a throw.

### Per-tool-class rule

1. **Autonomous + RBAC** — `create_product` in `getOrgAgentTools`;
   `assertCan("catalog:write")` in `execute`.
2. **Approval-gated** — `update_product` / `delete_product` with
   `needsApproval: true`; RBAC still runs post-approval (approval ≠
   authorization).
3. **No agent tool** — org/management mutations are never exposed
   (D-006/D-007); they hand off to the real screens.

## Gotchas

- **Money** fields are integer **minor units** — say so in descriptions.
- **No org tools** — the org is where chats live, not something the agent acts on.
- **`assertCan` on every write** — approval does not grant permission.
- **Product refs:** `update_product` / `delete_product` accept id or exact name
  via `resolveProductRef`; ambiguous refs → `conflict` (an **ask-point**:
  don't silently pick one match).
- **Verify after write:** a successful `{ ok: true }` means the mutation landed;
  still re-read (or rely on UI invalidation) before telling the user "done" if
  downstream views can lag.

## Adding a new tool

### Read tool

1. Add named pieces (`*Name`, `*Description`, `*InputSchema`, `*Execute`) in
   `tool-parts/<cap>/`.
2. `execute(ctx, input)` reads `ctx.organizationId`; put ids/filters in
   `inputSchema`.
3. For single-row getters: `requireFound(await getFoo(...), "Foo not found: …")`
   inside `execute`.
4. Import the pieces in `in-app/compose-org-tools.ts` and bind them in
   `getOrgAgentTools` and `getOrgAgentReadOnlyTools` if the sub-agent should
   see it. Re-declare each tool — do not loop a catalog array.

### Write tool (autonomous)

1. Named pieces with full `ToolContext` (writes call `assertCan`).
2. First line in `execute`: `await assertCan("catalog:write", ctx)` (or the
   right action).
3. Bind in `getOrgAgentTools` only (not the read-only compose).
4. Add to `AGENT_WRITE_TOOL_NAMES` / web invalidation registry if it mutates
   persisted state the UI should refresh.

### Approval-gated write

1. `needsApproval: true` on the **in-app bind**, not on the piece.
2. Keep `assertCan` inside `execute` (runs after user approves).
3. Compose into `getOrgAgentTools` (top-level alongside the other product tools).
4. Extend `tool-approvals.workerd.test.ts` if you add a new gated tool.

## Designing a new domain (optional grill)

When adding a **whole new domain** (not a single CRUD tool), don't dump a full
toolset in one shot:

1. Read the real core functions first (`file:line`).
2. State the **shape** of the step (table above).
3. Ask **one** decision with a recommendation (which tools / bundle vs compose /
   defer), then wait.
4. Record a ledger: step → tools → composability drop vs scope defer.
5. Next step.

For day-to-day "add `get_foo`," skip the grill and follow **Adding a new tool**.

## Tests

- Unit: `packages/agent/src/tools/tool-result.test.ts` — `requireFound` and
  `asToolResult` mapping.
- Agent: `packages/agent/src/in-app/__tests__/product-tools.test.ts` — in-app
  execute returns `ToolResult`, no throw on miss.
- Workerd: `apps/web/src/workerd-test/tool-approvals.workerd.test.ts` —
  `needsApproval` on `update_product` / `delete_product`; `sub-agent-tools.workerd.test.ts`
  — read-only composition + org-scoped reads.

## Files of interest

- `packages/agent/src/org/chat/org-chat.ts` — `getTools()` / `getSkills()` wiring
- `packages/agent/src/org/chat/search.ts` — cross-chat search bounds + merge
- `packages/agent/src/org/chat/fetch-allowlist.ts` — `FETCH_ALLOWED_HOSTS` parsing
- `packages/agent/src/org/chat/skills/` — bundled example skills
- `packages/agent/src/tool-parts/catalog/products.ts` — named pieces
- `packages/agent/src/in-app/compose-org-tools.ts` — compose entry points
- `packages/agent/src/tools/guard.ts` — RBAC
- `apps/web/src/features/assistant/components/chat-message-parts.tsx` — Approve/Reject UI + paused-execution card
