import type { Schema } from "hono";
import { Hono } from "hono";
import { requireActiveOrg } from "../middleware/organization";
import { requireAuth } from "../middleware/session";
import type { HonoContext, HonoContextWithAuthAndOrg } from "../types";
import { catalogRoutes } from "./catalog";

/**
 * The scope's guards wrap the resource at composition time: auth first, then
 * the live-membership check, as `use("*")` on a sub-app that only exists at
 * the resource prefix it is mounted under — a newly mounted resource cannot
 * go out unguarded, and the `"*"` is prefixed on mount, so nothing leaks to
 * sibling scopes. The return-type assertion keeps the resource's exact RPC
 * schema: a "/"-prefix mount does not change it, but TS cannot carry a
 * concrete schema through a generic boundary (inference falls back to the
 * constraint).
 */
export const withOrgAccess = <
  R extends Hono<HonoContextWithAuthAndOrg, Schema, string>,
>(
  routes: R
): R =>
  new Hono<HonoContextWithAuthAndOrg>()
    .use("*", requireAuth, requireActiveOrg)
    .route("/", routes) as R;

export const orgProtectedRoutes = new Hono<HonoContext>().route(
  "/catalog",
  withOrgAccess(catalogRoutes)
);
