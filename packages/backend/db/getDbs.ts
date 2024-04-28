import { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";

export async function getDbs() {
  const dbs = new Map();

  console.log(`Reading user directories...`);

  const userDirectories = await readdir(`${import.meta.dir}/dbs`);

  console.log(`User directories: ${userDirectories}`);

  for (const userDirectory of userDirectories) {
    const dbFiles = await readdir(`${import.meta.dir}/dbs/${userDirectory}`);

    dbs.set(userDirectory, dbFiles);
  }

  const databases = [];

  for (const [telegramId, dbNames] of dbs.entries()) {
    for (const dbName of dbNames) {
      const dbPath = `${import.meta.dirname}/dbs/${telegramId}/${dbName}`;
      const database = new Database(dbPath);
      databases.push(database); // Add the newly created database instance to the array
      console.log(`Database initialized at path: ${dbPath}`);
    }
  }
  return databases;
}

export async function getDbNamespaceAndNameMap() {
  const dbs = new Map();

  console.log(`Reading user directories...`);

  // Assuming import.meta.dir is correctly pointing to the directory of the current module
  const userDirectories = await readdir(`${import.meta.dir}/dbs`);

  console.log(`User directories: ${userDirectories}`);

  for (const userDirectory of userDirectories) {
    const dbFiles = await readdir(`${import.meta.dir}/dbs/${userDirectory}`);

    // Remove the .db suffix and add to the map
    const dbNames = dbFiles.map((fileName) => fileName.replace(/\.db$/, ""));
    dbs.set(userDirectory, dbNames);
  }

  return dbs;
}
