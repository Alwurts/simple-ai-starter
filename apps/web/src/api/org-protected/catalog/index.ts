import { Hono } from "hono";
import type { HonoContextWithAuthAndOrg } from "../../types";
import { productsRoutes } from "./products";

export const catalogRoutes = new Hono<HonoContextWithAuthAndOrg>().route(
  "/products",
  productsRoutes
);
