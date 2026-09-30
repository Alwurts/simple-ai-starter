---
name: components-composition
description: This repo's house style for authoring UI components (React 19 + Tailwind v4 + shadcn/cva, Base UI). Load before building or refactoring any component in packages/ui or apps/web. Covers flat naming, cn/cva variants, element swapping via Base UI's render prop, data-slot, compound + Provider state, and the packages/ui-imports-no-core boundary. It applies generic composition patterns (compound components, avoid-boolean-props, lift-state) to this stack.
---

# Components Composition

Build components the way this repo already builds them. This is the **house style** — the
*build* discipline from components.build plus the *composition* rules from Vercel's patterns,
filtered through this repo's reality. The reference component is
`packages/ui/src/components/shadcn/button.tsx`; when in doubt, mirror it.

> **Scope frame.** components.build is written for *publishing* reusable component libraries
> (Registry / Marketplace / NPM). We are building **an app + a template**, not a
> distributed library — take its build-quality rules, drop the publish posture and the
> library-grade "maximal flexibility everywhere" ceremony.

> Stack: React **19.2**, Tailwind **v4**, `class-variance-authority` + `clsx` + `tailwind-merge`
> (`cn` at `@workspace/ui/lib/utils`), and shadcn primitives
> under `packages/ui/src/components/shadcn`, built on **Base UI** (`@base-ui/react`) —
> the vendored primitives and the app's own components all use Base UI's `render`
> prop for element swapping.

## The rules

### 1. Naming — FLAT, not dot-namespace
Export each part as a **flat named function**: `Card`, `CardHeader`, `CardTitle`, `CardContent`,
`CardFooter`. **Reject** components.build's `Card.Header` dot-namespace — it diverges from the
shadcn baseline (every file under `packages/ui/src/components/shadcn`) and the registry model. This
applies to **internal feature compounds too** (`ComposerHeader`, `ComposerLines`), not
just primitives. The part-of relationship is expressed by the **name prefix + `data-slot`**, and
shared state by a **Provider** (rule 5/6) — not by a dot object.
- **This governs *our own* exports.** Third-party primitives keep their vendor namespace —
  `ComboboxPrimitive.Trigger`, `Dialog.Root`. Do not rewrap them to flatten.

### 2. One element per *leaf* component; props spread; className last
Each **leaf/part** component wraps a single element and spreads through. Type as
`React.ComponentProps<"div"> & { …custom }`. Spread `{...props}`, merge `className` **last** with
`cn` so callers win.
```tsx
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-xl border bg-card", className)} {...props} />
}
```
- **Exempt:** orchestrator/variant components (rule 3) and Providers (rule 5/6) compose parts —
  they don't wrap a single DOM element and have nothing to spread. The single-element/spread rule
  is for leaves.

### 3. Variants — visual via `cva`, structural via explicit components, never *mode* flags
- **Visual** (same DOM tree, same handlers, only classes/tokens differ) → a `cva` **variant/size
  union prop** (defined **outside** the component, typed with `VariantProps`). A **bare 2-value
  `data-size`/`data-variant` enum without a full `cva` block is also fine** (this is what
  `card.tsx` does — it is *not* a violation).
- **Structural** (different parts mounted, or different handlers/behavior) → **explicit variant
  components that share internal parts** via a Provider/compound: two thin components composing
  the same flat `Composer*` parts — **one route, two components**, not one component with an
  `isQuick` branch.
- **The test:** *would you need a `{cond && <Part/>}` (different tree) or a different handler?* →
  structural. Same tree, same handlers, only classes → visual.
- **Never** a boolean/enum **mode** flag on a *single public component* that selects *which parts
  render or which flow runs* (`<ChatPanel variant="inline"|"dialog">`, `isQuick`, `isEditing`).
  Each doubles the state space. An *internal* Provider receiving a `variant` from its two thin
  wrappers (below) is **fine** — the ban is on exposing the mode as the public entry point, not on
  configuring shared parts.
- **Exemptions to the mode-flag ban** (these are *not* mode flags):
  1. **Responsive branching** — a separate mobile shell component / `useIsMobile` split.
  2. **Async/data state** — `loading` / `error` / `empty` early-returns (and spinner + `disabled`
     on a button). Orthogonal state, not a variant.
  3. **Vendor composition flags** — `viewport`, `collapsible`, etc. on a Base UI primitive.
  4. **Optional subpart visibility** — a boolean that mounts/hides *one optional part*
     (`showTrigger`/`showClear` on combobox, `showHeader`) — not a flow selector.
- **Standard orthogonal booleans are fine and expected:** `disabled`, `open`,
  `checked`, `defaultOpen`, `loading`. The ban is *only* on booleans that select parts/flow.
```tsx
<Button variant="destructive" size="sm" />              // visual → cva
function QuickComposer() {                              // structural → explicit
  return <ComposerProvider variant="quick"><ComposerLines/><ComposerBar/></ComposerProvider>
}
// NEVER: <Composer isQuick isEditing />
```

### 4. Element swapping — the primitive's `render` prop, never a generic `as`
**Drop** the generic polymorphic `as` prop and its `ElementType` generics — Base UI's
**`render`** prop covers it, on both vendored primitives and our own wrappers:
```tsx
<ComboboxPrimitive.Clear render={<InputGroupButton size="icon-xs" />} />   // vendored primitive
<Button render={<Link href="/catalog" />} />                               // our components too
```
- Base UI `render` accepts an element **or** a `(props, state) => ReactElement` function, and
  `className`/`style` may be **functions of state**, not just strings.
- **`nativeButton`** — on a button-like Base UI part, if you `render` a non-`<button>` element,
  set `nativeButton={false}`. Default is context-dependent (native-button parts → `true`;
  non-native parts like `ComboboxItem` (a `<div>`) → `false`).
- Base UI's own composition primitives are **`useRender` + `mergeProps`** (from
  `@base-ui/react/use-render` and `@base-ui/react/merge-props` — hyphenated paths), the analog to
  radix `Slot` for authoring your own composable parts. `mergeProps` does **not** merge `ref`
  (separate merged-refs path) and merges handlers **right-to-left** with an
  `event.preventBaseUIHandler()` escape hatch.
- **Exception to "drop `as`":** a constrained tag-from-a-fixed-set (e.g. a `Heading` rendering
  `h1`–`h6` via a `level` union) may take that constrained union — *not* an open `ElementType`
  generic. The ban is on library-grade open polymorphism.

### 5. Compound components + Context for shared parts
Anything with parts: Root / Item / Trigger / Content (+ Header / Body / Footer / Title /
Description). Share state through **Context** (rule 6), not prop drilling. Parts stay flat-named
(rule 1) with a throwing guard hook (`useX` throws if used outside its Provider).
```tsx
const ComposerContext = createContext<ComposerValue | null>(null)
function useComposer() {
  const ctx = useContext(ComposerContext)
  if (!ctx) throw new Error("useComposer must be used within <ComposerProvider>")
  return ctx
}
function ComposerHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { title } = useComposer()
  return <div data-slot="composer-header" className={cn("…", className)} {...props}>{title}</div>
}
// Two thin wrappers compose <ComposerProvider variant="…"> with the flat parts.
```

### 6. State: simplest mode by default; flat context grouped by concern
- **Default to the single simplest mode.** Most state lives in the **URL (TanStack) or React
  Query** — call the hook in the component that **owns the action** (often the orchestrator/
  container, e.g. `create-product-dialog.tsx` calls `useCreateProduct()` at its top), no Context.
  Do **not** cargo-cult controlled+uncontrolled onto every component.
- **When parts must share state, the house default is a flat context value object** (state fields
  and action functions together — `sidebar.tsx`, `chat-input.tsx`,
  `org-connection.tsx`). **Split into multiple contexts by concern** when a part shouldn't
  re-render on changes it doesn't use. This is the only built-in way to get
  re-render isolation — `useContext` has no selector.
- **Extract derivations to pure functions** (`formatMoneyMinor(minorUnits)`, `canSubmit(state)`) and
  call them from the provider memo — so validation logic is unit-testable without rendering.
- **Escape hatch — `{ state, actions, meta }`:** *only* when the **same parts must run against 2+
  interchangeable data sources** (e.g. a live server doc vs an offline local draft), isolate *that
  one surface* behind a `{ state, actions, meta }` contract so adapters are compile-time
  interchangeable. **Never the default**, and don't introduce a `meta` bucket otherwise.

### 7. `data-*` for identity & state, props for configuration
`data-slot` mirrors the **full flat export name in kebab-case** (`composer-header`) for
unique descendant selectors. Purpose-named (`submit-button`, not `blueButton`). Style children
from a parent via `has-[…]`, `[&_[data-slot=…]]`, named `group/*` scopes. Props stay for
variants/behavior/handlers.
- **State attributes are primitive-specific — never copy a selector across libs.** Base UI
  never emits `data-state`; it uses `data-open`/`data-closed` (popups),
  `data-popup-open`/`data-pressed` (triggers), `data-highlighted`/`data-selected`/`data-disabled`
  (items), `data-starting-style`/`data-ending-style` (transitions), and **logical** `data-side`
  values (`inline-start`/`inline-end`).
- Check the part's own DataAttributes before writing `data-[state=…]`.

### 8. Styling — `cn`, caller's `className` wins
`cn` = `clsx` + `twMerge` from `@workspace/ui/lib/utils`. The caller's `className` must resolve
**last** so `twMerge` lets it win. Two house forms, both correct: pass it **through `cva`** —
`cn(buttonVariants({ variant, size, className }))` (the canonical `button.tsx`) — or as the **last
`cn` arg** on non-cva leaves — `cn("base classes", className)`. Never hand-concatenate.

### 9. React 19 idioms
No `forwardRef` — `ref` is a normal prop (`React.ComponentProps<T>` already carries it; use
`ComponentPropsWithRef` only when wrapping a primitive that needs the ref typed, see
`combobox.tsx`). **`useContext(Context)` is the house default** (matches all current consumers);
reach for `use(Context)` only when you need a conditional read (after an early return) or to unwrap
a promise under Suspense — do **not** mass-migrate existing `useContext`.

### 10. Types & a11y
Export a `<Name>Props` type for **app/feature composites**; shadcn-style primitives may keep an
inline `React.ComponentProps<…>` intersection (the baseline does — don't force an export there).
**In *prop* names**, avoid native-attribute clashes (a prop named `heading`,
not `title`, since `title` is a native attribute) — this does **not** affect component names
(`CardTitle` the component is correct). Children over render props, except when a child needs
per-item data the parent owns (virtualized/data-driven lists). Semantic elements +
keyboard/focus by default; ARIA only to supplement; preserve role/keyboard behavior when `render`
swaps the element.

## Layering & placement (non-negotiable)
- **`packages/ui`** = pure, **no `core`/`contract` imports**. Tiers under `components/`:
  `shadcn/*` (primitives), plus the app-flavored composite tier (`brand/*` — `DataTable`,
  `Shell`, `resource-table`). A piece that knows nothing about the domain lives here.
- **`apps/web`** = domain composites, in **feature folders** (`components/<cap>/` — `catalog/`,
  `organization/`, `search/`; chat composites live under
  `features/assistant/components/`). **kebab-case filenames**
  (`create-product-dialog.tsx`). Add `"use client"` to any file using hooks/context/state.
- Don't add a second `Intl.NumberFormat` for domain currency; reuse the formatters in
  `packages/ui/src/lib/money.ts`. Dates and quantities are fine.
- **Gated controls:** an action the current role can't run stays **visible but `disabled` with a
  reason**, never hidden. `packages/ui` stays pure (takes `disabled` + `disabledReason`, as
  `resource-table.tsx` does); the `apps/web` composite computes `disabled={!can(action)}` against
  the role gate.
- **Responsive:** tablet-primary, phone supported — responsive from the start, no desktop-only
  layouts.

## Pre-PR checklist
- [ ] Right tier/folder (`shadcn`/`brand`, `apps/web/components/<cap>/`, or `features/assistant/components/`); kebab filename; `"use client"` if stateful
- [ ] Flat-named exports; single element on leaves; `...props` spread; caller's `className` resolves last via `cn`
- [ ] Visual variants via `cva`/bare `data-*` enum; structural = explicit components; **no public mode flags** (async/responsive/vendor/optional-subpart exempt)
- [ ] Element swapping via Base UI `render`; no generic `as`
- [ ] Base UI part wrapped? `nativeButton` set if non-button; correct `data-*` selectors for *that* lib
- [ ] Parts share state via a flat context grouped by concern; derivations as pure fns; `{state,actions,meta}` only for multi-source
- [ ] Simplest state mode (URL/React Query in the action owner first); no needless dual-mode
- [ ] `data-slot` = full kebab export name; identity/UI state via `data-*`, behavior/controlled state via props
- [ ] No `forwardRef`; `useContext` (not `use()`) unless conditional/Suspense
- [ ] In `packages/ui`? Zero `core`/`contract` imports
- [ ] Gated control visible + `disabled`+reason, not hidden; `<Name>Props` exported for composites
