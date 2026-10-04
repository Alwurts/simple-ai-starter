# Starting questions

Read this before you edit when someone points you at this repo and wants it
turned into their app. They may not be technical. Ask in their words, then
change the template. Setup in the [README](../README.md#getting-started) is
your work: `pnpm install`, `.dev.vars`, `pnpm db:migrate`, `pnpm dev`, then
open http://localhost:4011. Do not ask them to run those commands.

Day-to-day work after the app is already theirs stays in
[`AGENTS.md`](../AGENTS.md) and [`docs/architecture.md`](architecture.md).

## What is already here

Say this in plain language before you ask, and skip any part they already
know.

- It is a private app. People sign up, name the business, and sign in. It is
  not a public shop window, and it does not take payment.
- The list is one example slice called `products`: a name, an optional short
  description, and a price. The sample rows are things like a mug, a kettle,
  and a scale. That slice is the one you rename. There is no photo, no count
  of how many are left, and no orders.
- Signed-in people can chat with an assistant that can look at the list and,
  after they approve, change it. The assistant can also remember a short fact
  about how the business works.
- Settings cover the organization and its members.

## How to ask

Ask **one** question per turn. A short follow-up in the same turn is fine.
Skip anything they already answered. Use their words for the business, the
list, and one item. Do not ask them to pick a stack, a database, a port, or a
CSS variable.

Stop when you can start. Enough is:

- what the business is called
- who signs in on the first day, and who does not
- what they call one item
- whether a name, a short description, and a price are enough

You may defer a full life story of the business, a second example item, and
the look-and-feel question. If they already answered the four points above,
start changing the app. Do not keep interviewing for completeness.

If two answers conflict, ask which one they mean before you code. Otherwise
carry on. Do not ask permission to continue once they have asked you to make
the app.

## Questions

Ask in this order. Reorder if they lead somewhere else.

1. **What should we call this, and what do you call one thing on the list?**
   The business name, and their word for an item.
2. **Who is it for on the first day?** Who signs in? Who does not? Just them,
   them and someone who helps, or customers too?
3. **What should the first version do?** A private list, a page other people
   can look at, or something else?
4. **For one item, are a name, a short description, and a price enough?** If
   not, what else should each item remember, such as a note, how many are
   left, or a photo?
5. **What should the chat help with, and what should it remember?** Ordinary
   questions about the list, and one standing fact about how they work. Skip
   if they already said they do not want the chat.
6. **What is one real item to put on the list?** Name, price, and anything
   from question 4, so the first screen is theirs.
7. **Look and feel, last.** Only if the four stop-condition answers are in.
   Describe the looks in [Look and feel](#look-and-feel) in one sentence
   each, and ask which is closest, or whether to leave it. Do not ask them
   for a color code.

## What you change

You translate the answers. They do not.

- Put their business name on the chrome. Replace the word Catalog, and the
  word for an item, everywhere a person can see it, including the assistant's
  wording.
- Rename the `products` slice through the layers. The map is
  [the worked example](architecture.md#worked-example-a-read-and-a-write-through-products).
  Change the whole slice, not only the sidebar label.
- Replace the sample rows with the item they gave you. If they
  have not named one yet, keep a single obvious placeholder in their words
  and replace it when they do.
- Add a column only when they asked for it on each item (a note, how many are
  left, a photo). A standing fact about the business, such as where pickup
  is, stays a memory the assistant already has. Do not invent a new table for
  that.
- Keep the chat unless they said they do not want it.
- When they need to look, tell them the address and the email and password
  you created, in one plain sentence. Create that account yourself.

Your replies stay in their words. Install trouble, ports, model names, and
stream glitches stay in your work. Do not narrate them.

## Look and feel

A look is the color tokens and `--radius` in
[`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css).
Describe these five in one sentence each and ask which is closest. There are
no pictures to show. If they want to see one, apply it, let them look at the
running app, and switch if they say so.

**Ink** is what ships: a white page, near-black buttons, slightly rounded
corners. Leave the file alone if they pick Ink or say to leave it.

**Clay** is warm paper, clay-colored buttons, and rounder corners.
**Harbor** is a cool pale page, blue buttons, and tighter corners.
**Bloom** is a faint rose page, berry buttons, and very round corners.
**Slate** is a gray page, dark slate buttons, and square corners.

For Clay, Harbor, Bloom, or Slate, set every variable in that look's `:root`
block and every variable in its `.dark` block. Leave `--destructive`,
`--destructive-foreground`, and `--chart-1` through `--chart-5` as they are.
Primary text has to stay readable on the primary color. The pairs below
already do. Do not ask them for a hex value or an `oklch` number.

### Clay

`:root`

```css
--background: oklch(0.975 0.012 80);
--foreground: oklch(0.28 0.04 50);
--card: oklch(0.99 0.008 80);
--card-foreground: oklch(0.28 0.04 50);
--popover: oklch(0.99 0.008 80);
--popover-foreground: oklch(0.28 0.04 50);
--primary: oklch(0.52 0.13 45);
--primary-foreground: oklch(0.98 0.01 80);
--secondary: oklch(0.94 0.02 75);
--secondary-foreground: oklch(0.32 0.04 50);
--muted: oklch(0.94 0.015 75);
--muted-foreground: oklch(0.48 0.03 55);
--accent: oklch(0.93 0.03 70);
--accent-foreground: oklch(0.32 0.04 50);
--border: oklch(0.88 0.02 70);
--input: oklch(0.88 0.02 70);
--ring: oklch(0.62 0.1 45);
--radius: 0.75rem;
--sidebar: oklch(0.96 0.018 75);
--sidebar-foreground: oklch(0.28 0.04 50);
--sidebar-primary: oklch(0.52 0.13 45);
--sidebar-primary-foreground: oklch(0.98 0.01 80);
--sidebar-accent: oklch(0.93 0.025 70);
--sidebar-accent-foreground: oklch(0.32 0.04 50);
--sidebar-border: oklch(0.88 0.02 70);
--sidebar-ring: oklch(0.62 0.1 45);
```

`.dark`

```css
--background: oklch(0.22 0.02 50);
--foreground: oklch(0.96 0.01 80);
--card: oklch(0.24 0.02 50);
--card-foreground: oklch(0.96 0.01 80);
--popover: oklch(0.24 0.02 50);
--popover-foreground: oklch(0.96 0.01 80);
--primary: oklch(0.75 0.1 55);
--primary-foreground: oklch(0.25 0.04 50);
--secondary: oklch(0.32 0.02 50);
--secondary-foreground: oklch(0.96 0.01 80);
--muted: oklch(0.32 0.02 50);
--muted-foreground: oklch(0.75 0.02 70);
--accent: oklch(0.34 0.03 50);
--accent-foreground: oklch(0.96 0.01 80);
--border: oklch(0.36 0.02 50);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.7 0.08 55);
--radius: 0.75rem;
--sidebar: oklch(0.26 0.025 50);
--sidebar-foreground: oklch(0.96 0.01 80);
--sidebar-primary: oklch(0.75 0.1 55);
--sidebar-primary-foreground: oklch(0.25 0.04 50);
--sidebar-accent: oklch(0.34 0.03 50);
--sidebar-accent-foreground: oklch(0.96 0.01 80);
--sidebar-border: oklch(0.36 0.02 50);
--sidebar-ring: oklch(0.7 0.08 55);
```

### Harbor

`:root`

```css
--background: oklch(0.985 0.01 250);
--foreground: oklch(0.25 0.04 260);
--card: oklch(0.995 0.005 250);
--card-foreground: oklch(0.25 0.04 260);
--popover: oklch(0.995 0.005 250);
--popover-foreground: oklch(0.25 0.04 260);
--primary: oklch(0.45 0.14 255);
--primary-foreground: oklch(0.98 0.01 250);
--secondary: oklch(0.94 0.02 250);
--secondary-foreground: oklch(0.28 0.04 260);
--muted: oklch(0.94 0.015 250);
--muted-foreground: oklch(0.45 0.03 255);
--accent: oklch(0.93 0.03 250);
--accent-foreground: oklch(0.28 0.04 260);
--border: oklch(0.88 0.02 250);
--input: oklch(0.88 0.02 250);
--ring: oklch(0.55 0.1 255);
--radius: 0.5rem;
--sidebar: oklch(0.96 0.02 250);
--sidebar-foreground: oklch(0.25 0.04 260);
--sidebar-primary: oklch(0.45 0.14 255);
--sidebar-primary-foreground: oklch(0.98 0.01 250);
--sidebar-accent: oklch(0.93 0.025 250);
--sidebar-accent-foreground: oklch(0.28 0.04 260);
--sidebar-border: oklch(0.88 0.02 250);
--sidebar-ring: oklch(0.55 0.1 255);
```

`.dark`

```css
--background: oklch(0.18 0.03 260);
--foreground: oklch(0.96 0.01 250);
--card: oklch(0.22 0.03 260);
--card-foreground: oklch(0.96 0.01 250);
--popover: oklch(0.22 0.03 260);
--popover-foreground: oklch(0.96 0.01 250);
--primary: oklch(0.75 0.12 250);
--primary-foreground: oklch(0.2 0.04 260);
--secondary: oklch(0.28 0.03 260);
--secondary-foreground: oklch(0.96 0.01 250);
--muted: oklch(0.28 0.03 260);
--muted-foreground: oklch(0.75 0.02 250);
--accent: oklch(0.32 0.04 255);
--accent-foreground: oklch(0.96 0.01 250);
--border: oklch(0.34 0.03 260);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.7 0.1 250);
--radius: 0.5rem;
--sidebar: oklch(0.2 0.03 260);
--sidebar-foreground: oklch(0.96 0.01 250);
--sidebar-primary: oklch(0.75 0.12 250);
--sidebar-primary-foreground: oklch(0.2 0.04 260);
--sidebar-accent: oklch(0.32 0.04 255);
--sidebar-accent-foreground: oklch(0.96 0.01 250);
--sidebar-border: oklch(0.34 0.03 260);
--sidebar-ring: oklch(0.7 0.1 250);
```

### Bloom

`:root`

```css
--background: oklch(0.98 0.015 15);
--foreground: oklch(0.28 0.05 15);
--card: oklch(0.995 0.008 15);
--card-foreground: oklch(0.28 0.05 15);
--popover: oklch(0.995 0.008 15);
--popover-foreground: oklch(0.28 0.05 15);
--primary: oklch(0.55 0.2 12);
--primary-foreground: oklch(0.98 0.01 20);
--secondary: oklch(0.95 0.02 15);
--secondary-foreground: oklch(0.32 0.05 15);
--muted: oklch(0.95 0.015 15);
--muted-foreground: oklch(0.48 0.04 15);
--accent: oklch(0.94 0.03 15);
--accent-foreground: oklch(0.32 0.05 15);
--border: oklch(0.9 0.02 15);
--input: oklch(0.9 0.02 15);
--ring: oklch(0.62 0.14 12);
--radius: 1rem;
--sidebar: oklch(0.97 0.02 15);
--sidebar-foreground: oklch(0.28 0.05 15);
--sidebar-primary: oklch(0.55 0.2 12);
--sidebar-primary-foreground: oklch(0.98 0.01 20);
--sidebar-accent: oklch(0.94 0.03 15);
--sidebar-accent-foreground: oklch(0.32 0.05 15);
--sidebar-border: oklch(0.9 0.02 15);
--sidebar-ring: oklch(0.62 0.14 12);
```

`.dark`

```css
--background: oklch(0.2 0.03 15);
--foreground: oklch(0.96 0.01 20);
--card: oklch(0.23 0.03 15);
--card-foreground: oklch(0.96 0.01 20);
--popover: oklch(0.23 0.03 15);
--popover-foreground: oklch(0.96 0.01 20);
--primary: oklch(0.75 0.15 15);
--primary-foreground: oklch(0.22 0.05 15);
--secondary: oklch(0.3 0.03 15);
--secondary-foreground: oklch(0.96 0.01 20);
--muted: oklch(0.3 0.03 15);
--muted-foreground: oklch(0.75 0.03 15);
--accent: oklch(0.34 0.05 15);
--accent-foreground: oklch(0.96 0.01 20);
--border: oklch(0.36 0.03 15);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.72 0.12 15);
--radius: 1rem;
--sidebar: oklch(0.22 0.03 15);
--sidebar-foreground: oklch(0.96 0.01 20);
--sidebar-primary: oklch(0.75 0.15 15);
--sidebar-primary-foreground: oklch(0.22 0.05 15);
--sidebar-accent: oklch(0.34 0.05 15);
--sidebar-accent-foreground: oklch(0.96 0.01 20);
--sidebar-border: oklch(0.36 0.03 15);
--sidebar-ring: oklch(0.72 0.12 15);
```

### Slate

`:root`

```css
--background: oklch(0.97 0.005 260);
--foreground: oklch(0.2 0.02 260);
--card: oklch(0.99 0.003 260);
--card-foreground: oklch(0.2 0.02 260);
--popover: oklch(0.99 0.003 260);
--popover-foreground: oklch(0.2 0.02 260);
--primary: oklch(0.3 0.03 260);
--primary-foreground: oklch(0.98 0 0);
--secondary: oklch(0.93 0.008 260);
--secondary-foreground: oklch(0.25 0.02 260);
--muted: oklch(0.93 0.006 260);
--muted-foreground: oklch(0.45 0.02 260);
--accent: oklch(0.92 0.01 260);
--accent-foreground: oklch(0.25 0.02 260);
--border: oklch(0.86 0.01 260);
--input: oklch(0.86 0.01 260);
--ring: oklch(0.5 0.03 260);
--radius: 0rem;
--sidebar: oklch(0.94 0.008 260);
--sidebar-foreground: oklch(0.2 0.02 260);
--sidebar-primary: oklch(0.3 0.03 260);
--sidebar-primary-foreground: oklch(0.98 0 0);
--sidebar-accent: oklch(0.9 0.01 260);
--sidebar-accent-foreground: oklch(0.25 0.02 260);
--sidebar-border: oklch(0.86 0.01 260);
--sidebar-ring: oklch(0.5 0.03 260);
```

`.dark`

```css
--background: oklch(0.16 0.01 260);
--foreground: oklch(0.96 0.005 260);
--card: oklch(0.2 0.012 260);
--card-foreground: oklch(0.96 0.005 260);
--popover: oklch(0.2 0.012 260);
--popover-foreground: oklch(0.96 0.005 260);
--primary: oklch(0.9 0.01 260);
--primary-foreground: oklch(0.18 0.02 260);
--secondary: oklch(0.26 0.012 260);
--secondary-foreground: oklch(0.96 0.005 260);
--muted: oklch(0.26 0.012 260);
--muted-foreground: oklch(0.72 0.01 260);
--accent: oklch(0.3 0.015 260);
--accent-foreground: oklch(0.96 0.005 260);
--border: oklch(0.32 0.012 260);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.7 0.02 260);
--radius: 0rem;
--sidebar: oklch(0.18 0.012 260);
--sidebar-foreground: oklch(0.96 0.005 260);
--sidebar-primary: oklch(0.9 0.01 260);
--sidebar-primary-foreground: oklch(0.18 0.02 260);
--sidebar-accent: oklch(0.3 0.015 260);
--sidebar-accent-foreground: oklch(0.96 0.005 260);
--sidebar-border: oklch(0.32 0.012 260);
--sidebar-ring: oklch(0.7 0.02 260);
```
