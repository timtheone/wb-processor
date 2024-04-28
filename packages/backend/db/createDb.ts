import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { readdir, mkdir } from "node:fs/promises";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { simulateDelay } from "../src/utils/delay";

export const createOrOpenDatabase = async (
  dbName: string,
  telegramId: string
) => {
  try {
    await readdir(`${import.meta.dir}/dbs/${telegramId}`);
  } catch (error) {
    await mkdir(`${import.meta.dir}/dbs/${telegramId}`, { recursive: true });
  }

  const fileValue = Bun.file(
    `${import.meta.dir}/dbs/${telegramId}/${dbName}.db`
  );

  const fileExists = await fileValue.exists();

  if (!fileExists) {
    const database = new Database(
      `${import.meta.dirname}/dbs/${telegramId}/${dbName}.db`
    );

    migrate(drizzle(database), {
      migrationsFolder: `${import.meta.dirname}/migrations`,
    });

    database.close();

    simulateDelay(300);

    const databaseOpened = new Database(
      `${import.meta.dirname}/dbs/${telegramId}/${dbName}.db`
    );
    return drizzle(databaseOpened, {
      schema,
    });
  } else {
    const database = new Database(
      `${import.meta.dirname}/dbs/${telegramId}/${dbName}.db`
    );
    return drizzle(database, {
      schema,
    });
  }
};
