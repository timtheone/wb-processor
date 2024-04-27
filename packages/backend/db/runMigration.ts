import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { getDbs } from "./getDbs";

async function migrateDb() {
  const databases = await getDbs();

  for (const db of databases) {
    migrate(drizzle(db), {
      migrationsFolder: `${import.meta.dirname}/migrations`,
    });

    db.close();
  }
}

migrateDb();
