import { Hono } from "hono";
import type { HonoContextWithAuthAndOrg } from "../../types";
import { productsRoutes } from "./products";
import { searchRoutes } from "./search";

const catalogRoutes = new Hono<HonoContextWithAuthAndOrg>()
  .route("/products", productsRoutes)
  .route("/search", searchRoutes);

export default catalogRoutes;
