import { Hono } from "hono";
import type { HonoContext } from "../types";

export const healthRoutes = new Hono<HonoContext>().get("/", (c) =>
  c.json({ ok: true })
);
