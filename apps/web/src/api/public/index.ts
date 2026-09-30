import { Hono } from "hono";
import { extractAuth } from "../middleware/session";
import type { HonoContext } from "../types";
import { healthRoutes } from "./health";

// extractAuth is the one deliberate global: mounted first, it resolves the
// session exactly once for every /api route. It gates nothing — scopes that
// require a session apply their own guards.
export const publicRoutes = new Hono<HonoContext>()
  .use("*", extractAuth)
  .route("/health", healthRoutes);
