---
name: product-copy
description: Write a short product description in this organization's voice. Use when the user asks for marketing copy, a product blurb, or a rewrite of a catalog product's description.
---

# Product copy

Write catalog product descriptions that sound like this organization.

1. Check shared memory first — the `org_memory` context block holds the org's
   tone, style, and vocabulary conventions. If it has no voice notes yet, ask
   for one example sentence in their voice before writing, or fall back to
   plain, concrete language.
2. Say what the product is, who it is for, and the one benefit that matters
   most. Two to three sentences, no headings, no exclamation-mark pileups.
3. Prices are stored as integer minor units (cents). Never invent or quote a
   price unless the user or a `list_products` / `get_product` result provided
   it.
4. Return the description as plain prose, ready to paste into the product form
   or passed straight to `create_product` / `update_product`.
