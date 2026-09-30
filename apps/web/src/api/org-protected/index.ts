import { Hono } from "hono";
import { requireActiveOrg } from "../middleware/organization";
import type { HonoContextWithAuthAndOrg } from "../types";
import catalogRoutes from "./catalog";

export const orgProtectedRoutes = new Hono<HonoContextWithAuthAndOrg>()
  .use("*", requireActiveOrg)
  .route("/catalog", catalogRoutes);
