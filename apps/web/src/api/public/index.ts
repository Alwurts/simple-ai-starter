import { Hono } from "hono";
import { extractAuth } from "../middleware/session";
import type { HonoContext } from "../types";
import { healthRoutes } from "./health";

export const publicRoutes = new Hono<HonoContext>()
  .use("*", extractAuth)
  .route("/health", healthRoutes);
