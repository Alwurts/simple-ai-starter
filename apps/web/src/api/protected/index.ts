import type { Schema } from "hono";
import { Hono } from "hono";
import { requireAuth } from "../middleware/session";
import type { HonoContext, HonoContextWithAuth } from "../types";
import { chatRoutes } from "./chat";

/**
 * The scope's guard wraps each resource at composition time: `use("*")` lives
 * on a sub-app that only exists at the resource prefix it is mounted under —
 * a newly mounted resource cannot go out unguarded, and the `"*"` is
 * prefixed on mount, so it cannot leak to sibling scopes. The return-type
 * assertion keeps the resource's exact RPC schema: a "/"-prefix mount does
 * not change it, but TS cannot carry a concrete schema through a generic
 * boundary (inference falls back to the constraint).
 */
export const withAuth = <R extends Hono<HonoContextWithAuth, Schema, string>>(
  routes: R
): R =>
  new Hono<HonoContextWithAuth>().use("*", requireAuth).route("/", routes) as R;

export const protectedRoutes = new Hono<HonoContext>().route(
  "/chat",
  withAuth(chatRoutes)
);
