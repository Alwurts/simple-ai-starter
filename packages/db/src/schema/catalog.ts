import { relations } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, moneyMinor, timestamps } from "../utils";
import { organization } from "./auth";

export const products = sqliteTable(
  "products",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: moneyMinor("price").default(0).notNull(),
    ...timestamps,
  },
  (table) => [index("products_organizationId_idx").on(table.organizationId)]
);

export const productsRelations = relations(products, ({ one }) => ({
  organization: one(organization, {
    fields: [products.organizationId],
    references: [organization.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
