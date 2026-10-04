# Starting questions

Read this before you edit when someone points you at this repo and wants it
turned into their app. They may not be technical. Ask in their words. Setup
in the [README](../README.md#getting-started) is your work. Do not ask them
to run commands.

Day-to-day work after the app is theirs stays in [`AGENTS.md`](../AGENTS.md)
and [`docs/architecture.md`](architecture.md).

## What is already here

Say this in plain language, and skip anything they already know.

- You can help them make the app they need.
- The app is private. People sign in. It does not take payment.
- It already comes with an agent. The agent can see the information they let
  it see, help organize it, and do work for them. It asks before it changes
  anything.

The template also has one example list, `products`, with a name, an optional
short description, and a price. The sample rows are placeholders. Settings
cover the organization and its members. There are no photos, no count of how
many are left, and no orders. Say these only when they matter.

## How to ask

One question at a time. Skip anything they already answered. Do not ask them
to pick a stack, a database, a port, or a color code.

Stop when you know what they want the app to do, who it is for, what the
first version should do, and what they want the agent to take care of. Then
change the app. A real example and the look can wait.

If their answer is a list of things, ask what each one should remember. The
template already has a name, a short description, and a price. Add a field
only when they asked for it.

## Questions

1. What do you want this app to do?
2. Who is it for on the first day, and who is not?
3. What should the first version let you do?
4. What would you like the agent to take care of?
5. What is one real example we should put in, so the first screen is yours?
6. Leave the look as it is, or change it? See [Look](#look).

## What you change

Set the app up for them, including how they sign in. When they want to see
it, give the address and the sign-in in one sentence. Do not ask them to
sign up or to name the business in the form.

Do not invent an example to check your work. Use a real one they gave you.
Until then, leave the examples that came with the template.

Use their words everywhere they will read them, including what the assistant
says. Do not invent a shorter name.

When their app is a list of things, reshape the `products` slice. The map is
[the worked example](architecture.md#worked-example-a-read-and-a-write-through-products).
Add a field only when they asked for it on each thing. A standing fact about
how they work stays a memory the agent already has. Keep the agent unless
they said they do not want it.

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
