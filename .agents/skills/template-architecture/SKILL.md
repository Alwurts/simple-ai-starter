---
name: template-architecture
description: How this template is structured — the layer-sliced, feature-keyed architecture (db / contract / core / surfaces / agent / ui / components), the cross-layer capability-key rule, the two schema sources (no drizzle-zod), and where a new capability slice goes. Load this before adding or moving a capability, a package, a Hono route, an AI tool, or a schema, or whenever you need to know where something lives in this repo.
---

# Template architecture

This skill is a thin trigger. The knowledge itself lives in the repo's
canonical docs (single source of truth) — read the relevant file directly
rather than restating it here.

## Read these

- **The one map** — layers, how a feature flows through them, the boundary
  rules: read `docs/architecture.md`.
- **Why a choice was made** (under a strict significance bar): browse
  `docs/decisions/` (e.g. `004-schema-sources-and-boundary-types.md` for the
  two-schema-source / no-drizzle-zod rule).
- **How to do or extend something here**: read the relevant guide under
  `docs/guides/`.

## The one rule to remember

A capability uses the **same key in every layer**. The `catalog` capability is
exactly: `packages/db/src/schema/catalog.ts` · `packages/contract/src/catalog/`
· `packages/core/src/catalog/` · `apps/web/src/hono/org-protected/catalog/` ·
`packages/agent/src/tool-parts/catalog/` · `apps/web/src/components/catalog/`. Find
one slice and you know where the other five live. See `docs/architecture.md`
for the worked example.
