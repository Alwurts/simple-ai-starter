import { Hono } from "hono";
import { requireAuth } from "../middleware/session";
import type { HonoContext } from "../types";
import { chatRoutes } from "./chat";

export const protectedRoutes = new Hono<HonoContext>()
  .use("/chat/*", requireAuth)
  .route("/chat", chatRoutes);
