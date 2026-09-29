# Comment hygiene

## The smell / the question

A comment earns its place only when it explains something **not inherent** in
the code — business process, external constraints, races, platform quirks, or
a non-obvious *why*. If a competent reader can infer the same fact from names,
types, or the next line in a few seconds, the comment is noise.

Common smells in this repo:

| Remove | Keep |
|--------|------|
| Section / JSX banners (`// --- Helpers ---`, `{/* Logo Area */}`) | Why / invariants / races / platform quirks |
| Name-echo JSDoc / inline narration | ADR / ALW / § / issue links |
| Lettered substeps that only label the next insert | Invariants / RBAC / security |
| Numbered pipeline labels (`// 1. READ`) when order is obvious | `biome-ignore` / `@ts-expect-error` **with** reason |
| Duplicate boilerplate (dedupe to one copy with real why) | Empty-catch markers Biome needs |
| Commented-out code; AI hedge (`Note:`, `Important:`) | Schema comments encoding real constraints (UNIQUE/NULL quirks) |

**Prefer refactor over a clarifying comment** when the code is unclear — rename
or extract so the name carries the meaning. That is a separate task; a hygiene
pass only **removes** dumb comments, it does not rename or restructure.

**Do not** strip open `TODO`/`FIXME` that reference real work.

## The preferred pattern

Write self-descriptive code. When something truly needs explanation, say *why*
once — at module scope, on a non-obvious block, or with a link to an ADR —
not on every sibling file.

```ts
// Bad — narrates the next line
// Look up the product by id in this org.
const product = await getProduct(id, orgId);

// Good — the query + error message are self-describing; no comment needed
const product = await getProduct(id, orgId);
if (!product) {
  throw new DomainError(`Product not found: ${id}`, "not_found");
}

// Good — documents a platform quirk the types cannot express
// Survive DO hibernation (onConnect does not re-run on wake).
connection.setState({ userId });
```

```tsx
// Bad
{/* Logo Area */}
<LogoMark />

// Good — no banner; the component name is enough
<LogoMark />
```

Linter directives stay, but **always with a reason** on the same line:

```ts
// biome-ignore lint/style/useErrorCause: DomainError accepts ErrorOptions.cause
```

## Files of Interest

- `AGENTS.md` — short Code standards bullets + link here
- `packages/core/src/catalog/products.ts` — org-scoped product queries/writes; keep the ref-resolution (ambiguity → `conflict`) rationale, drop step banners
- `packages/agent/src/tool-parts/catalog/products.ts` — tool-piece naming/description contracts (keep)
- `packages/agent/src/tools/guard.ts` — RBAC / mutation boundary (always keep)
- `packages/agent/src/org/chat/org-chat.ts` — hibernation / WebSocket-ALS platform quirks (keep)
- `apps/web/test/migration-safety.workerd.test.ts` — D1 FK-pragma invariant (ADR-007; always keep)
- `apps/web/src/components/chat/window/chat-window.tsx` — ticket-linked framework rationale (keep)
- Prior art: sfab ALW-338 / PR #362; starter ALW-334 / PRs #10–#11
