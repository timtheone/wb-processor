import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  driver: "better-sqlite",
  dbCredentials: {
    url: "./db/dbs/438143658/test1_LUIZETKA.db",
  },
  out: "./db/migrations",
  verbose: true,
});
