import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database(`${import.meta.dirname}/dbs/sqlite.db`);
export const db = drizzle(sqlite);

migrate(db, { migrationsFolder: `${import.meta.dirname}/migrations` });

sqlite.close();
