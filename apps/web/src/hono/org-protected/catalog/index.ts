import { Hono } from "hono";
import type { HonoContextWithAuthAndOrg } from "../../types";
import productsRoute from "./products";
import searchRoute from "./search";

const catalogRoutes = new Hono<HonoContextWithAuthAndOrg>()
  .route("/products", productsRoute)
  .route("/search", searchRoute);

export default catalogRoutes;
