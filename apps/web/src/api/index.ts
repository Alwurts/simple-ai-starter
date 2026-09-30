import { auth } from "@workspace/auth";
import { Hono } from "hono";
import { appErrorHandler } from "./middleware/error-handler";
import { orgProtectedRoutes } from "./org-protected";
import { protectedRoutes } from "./protected";
import { publicRoutes } from "./public";

export const app = new Hono()
  .onError(appErrorHandler)
  .on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/", publicRoutes)
  .route("/", protectedRoutes)
  .route("/", orgProtectedRoutes);

export type AppType = typeof app;
