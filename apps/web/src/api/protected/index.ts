import { Hono } from "hono";
import { requireAuth } from "../middleware/session";
import type { HonoContext } from "../types";
import { chatRoutes } from "./chat";
import { organizationRoutes } from "./organization";

const meRoute = new Hono<HonoContext>().get("/me", (c) => {
  const user = c.get("user");
  const session = c.get("session");
  return c.json({ user, session });
});

export const protectedRoutes = new Hono<HonoContext>()
  .use("/me", requireAuth)
  .route("/", meRoute)
  .use("/organization/*", requireAuth)
  .route("/organization", organizationRoutes)
  .use("/chat/*", requireAuth)
  .route("/chat", chatRoutes);
