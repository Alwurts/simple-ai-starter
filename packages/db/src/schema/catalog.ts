import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, moneyMinor, timestamps } from "../utils";

export const products = sqliteTable("products", {
  id: id(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: moneyMinor("price").default(0).notNull(),
  ...timestamps,
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
