import { Hono } from "hono";
import { requireActiveOrg } from "../middleware/organization";
import { requireAuth } from "../middleware/session";
import type { HonoContext } from "../types";
import catalogRoutes from "./catalog";

export const orgProtectedRoutes = new Hono<HonoContext>()
  .use("/catalog/*", requireAuth, requireActiveOrg)
  .route("/catalog", catalogRoutes);
