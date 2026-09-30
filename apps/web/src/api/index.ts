import { auth } from "@workspace/auth";
import { Hono } from "hono";
import { apiNotFound, appErrorHandler } from "./middleware/error-handler";
import { orgProtectedRoutes } from "./org-protected";
import { protectedRoutes } from "./protected";
import { publicRoutes } from "./public";

export const app = new Hono()
  .onError(appErrorHandler)
  .notFound(apiNotFound)
  .on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/", publicRoutes)
  .route("/", protectedRoutes)
  .route("/", orgProtectedRoutes)
  .all("*", apiNotFound);

export type AppType = typeof app;
