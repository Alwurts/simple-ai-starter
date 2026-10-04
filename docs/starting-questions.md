# Starting questions

Read this before you edit when someone points you at this repo and wants it
turned into their app. They may not be technical. Ask in their words. Setup
in the [README](../README.md#getting-started) is your work. Do not ask them
to run commands.

Day-to-day work after the app is theirs stays in [`AGENTS.md`](../AGENTS.md)
and [`docs/architecture.md`](architecture.md).

## What is already here

Say this in plain language, and skip anything they already know.

- A private app. People sign up, name the business, and sign in. It is not a
  public shop, and it does not take payment.
- One example list, `products`: a name, an optional short description, and a
  price. The sample rows are placeholders. That list is the one you rename.
  There are no photos, no count of how many are left, and no orders.
- A chat for signed-in people. It can look at the list and, after they
  approve, change it. It can also remember a short fact about how they work.
- Settings for the organization and its members.

## How to ask

One question at a time. Skip anything they already answered. Do not ask them
to pick a stack, a database, a port, or a color code.

Stop when you know the business name, who it is for, what they call one item,
and whether a name, a description, and a price are enough. Then change the
app. The chat, a sample item, and the look can wait.

## Questions

1. What should we call this, and what do you call one thing on the list?
2. Who is it for on the first day, and who is not?
3. What should the first version do?
4. For one item, are a name, a short description, and a price enough? What
   else should each item remember?
5. Do you want the chat, and should it remember anything about how you work?
6. What is one real item to put on the list, so the first screen is yours?
7. Leave the look as it is, or change it? See [Look](#look).

## What you change

Use their words on the screen, including the assistant's. Rename the
`products` slice through the layers. The map is
[the worked example](architecture.md#worked-example-a-read-and-a-write-through-products).
Replace the sample rows with their item. Add a field only when they asked for
it on each item. A standing fact about how they work stays a memory the
assistant already has. Keep the chat unless they said they do not want it.
When they need to look, tell them the address and the sign-in in one plain
sentence.

## Look

Ask only after the app already reflects their answers. Describe the choices
in a sentence. There are no pictures.

- **As it is.** White page, near-black buttons, slightly rounded corners.
  Change nothing.
- **Warmer**, **cooler**, or **brighter** buttons and page.
- **Rounder** corners, or **square** corners.

If they pick a change, edit
[`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css)
in both `:root` and `.dark`. Set the same tokens in both places.

Color: `--background`, `--foreground`, `--card`, `--card-foreground`,
`--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`,
`--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`,
`--accent`, `--accent-foreground`, `--border`, `--input`, `--ring`,
`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
`--sidebar-primary-foreground`, `--sidebar-accent`,
`--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

Corners: `--radius`. The shipped value is `0.625rem`. Larger is rounder.
`0rem` is square.

Leave `--destructive`, `--destructive-foreground`, and `--chart-1` through
`--chart-5` alone. Text on a button has to stay readable. Apply the change
and let them look at the running app. Switch it if they say so.
