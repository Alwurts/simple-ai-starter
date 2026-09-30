import { zValidator } from "@hono/zod-validator";
import { db } from "@workspace/db";
import { Hono } from "hono";
import { z } from "zod";
import type { HonoContextWithAuth } from "../types";

const checkSlugSchema = z.object({
  slug: z.string().min(3).max(50),
});

export const organizationRoutes = new Hono<HonoContextWithAuth>()
  .get("/membership", async (c) => {
    const userId = c.get("user").id;
    const membership = await db.query.member.findFirst({
      where: (member, { eq }) => eq(member.userId, userId),
      with: {
        organization: true,
      },
    });
    return c.json(membership);
  })
  .post("/check-slug", zValidator("json", checkSlugSchema), async (c) => {
    const { slug } = c.req.valid("json");
    const existingOrg = await db.query.organization.findFirst({
      where: (org, { eq }) => eq(org.slug, slug),
    });
    return c.json({ available: !existingOrg });
  });
