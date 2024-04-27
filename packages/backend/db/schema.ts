import { text, sqliteTable, integer } from "drizzle-orm/sqlite-core";

export const productCards = sqliteTable("productCards", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  vendorCode: text("vendorCode"),
  brand: text("brand"),
  title: text("title"),
  img: text("img"),
  ageGroup: text("ageGroup"),
  updatedAt: text("updatedAt"),
  createdAt: text("createdAt"),
});

export const shopToken = sqliteTable("shopToken", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  token: text("token"),
});
