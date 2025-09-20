#!/usr/bin/env bun

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { shopToken } from "../db/schema";
import { sql } from "drizzle-orm";

async function updateTokenInSpecificDatabase(
  newToken: string,
  telegramId: string,
  shopName: string
) {
  const dbPath = join(
    import.meta.dir,
    "../db/dbs",
    telegramId,
    `${shopName}.db`
  );

  try {
    // Check if the specific database file exists
    await stat(dbPath);
  } catch (error) {
    throw new Error(
      `Database not found: ${telegramId}/${shopName}.db\nMake sure the path is correct.`
    );
  }

  try {
    console.log(`🔄 Updating token for: ${telegramId}/${shopName}`);

    // Open database connection
    const database = new Database(dbPath);
    const db = drizzle(database, { schema: { shopToken } });

    // Check if token exists
    const existingTokens = await db
      .select({ id: shopToken.id, token: shopToken.token })
      .from(shopToken);

    if (existingTokens.length === 0) {
      // Insert new token
      await db.insert(shopToken).values({ token: newToken });
      console.log(`✅ Token inserted successfully`);
    } else {
      const oldToken = existingTokens[0].token;
      // Update existing token
      await db
        .update(shopToken)
        .set({ token: newToken })
        .where(sql`id = ${existingTokens[0].id}`);
      console.log(`✅ Token updated successfully`);
      console.log(`   Old token: ${oldToken?.substring(0, 20)}...`);
      console.log(`   New token: ${newToken.substring(0, 20)}...`);
    }

    database.close();
    return true;
  } catch (error) {
    throw new Error(`Failed to update token: ${error.message}`);
  }
}

async function listAllDatabases() {
  const dbsPath = join(import.meta.dir, "../db/dbs");

  try {
    await stat(dbsPath);
  } catch (error) {
    console.log("No databases found. The dbs directory doesn't exist yet.");
    return;
  }

  try {
    const telegramDirs = await readdir(dbsPath);

    if (telegramDirs.length === 0) {
      console.log("No telegram directories found.");
      return;
    }

    console.log("📋 Available databases:");
    let totalDatabases = 0;

    for (const telegramId of telegramDirs) {
      const telegramPath = join(dbsPath, telegramId);

      try {
        const stats = await stat(telegramPath);
        if (!stats.isDirectory()) continue;

        const files = await readdir(telegramPath);
        const dbFiles = files.filter((file) => file.endsWith(".db"));

        if (dbFiles.length > 0) {
          console.log(`\n  📁 ${telegramId}/`);
          for (const dbFile of dbFiles) {
            const shopName = dbFile.replace(".db", "");
            console.log(`    📄 ${shopName}`);
            totalDatabases++;
          }
        }
      } catch (error) {
        console.error(
          `Error reading telegram ID ${telegramId}:`,
          error.message
        );
      }
    }

    console.log(`\n   Total databases: ${totalDatabases}`);
  } catch (error) {
    console.error("Error reading databases directory:", error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

function showUsage() {
  console.error("Usage:");
  console.error(
    "  bun run scripts/updateToken.ts <new-token> <telegram-id> <shop-name>"
  );
  console.error("  bun run scripts/updateToken.ts --list");
  console.error("");
  console.error("Examples:");
  console.error(
    "  bun run scripts/updateToken.ts eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... 123456789 shop1"
  );
  console.error(
    "  bun run scripts/updateToken.ts --list  # Show all available databases"
  );
  console.error("");
  console.error("Arguments:");
  console.error("  <new-token>    The new token to set");
  console.error("  <telegram-id>  The telegram ID directory");
  console.error(
    "  <shop-name>    The shop database name (without .db extension)"
  );
}

if (args.length === 0) {
  showUsage();
  process.exit(1);
}

// Handle --list command
if (args[0] === "--list" || args[0] === "-l") {
  listAllDatabases()
    .then(() => {
      console.log(
        "\n💡 Use the format: <telegram-id> <shop-name> when updating tokens"
      );
    })
    .catch((error) => {
      console.error("❌ Error listing databases:", error);
      process.exit(1);
    });
} else {
  // Handle token update command
  if (args.length !== 3) {
    console.error("❌ Error: All three arguments are required\n");
    showUsage();
    process.exit(1);
  }

  const [newToken, telegramId, shopName] = args;

  if (!newToken || newToken.trim().length === 0) {
    console.error("❌ Error: Token cannot be empty");
    process.exit(1);
  }

  if (!telegramId || telegramId.trim().length === 0) {
    console.error("❌ Error: Telegram ID cannot be empty");
    process.exit(1);
  }

  if (!shopName || shopName.trim().length === 0) {
    console.error("❌ Error: Shop name cannot be empty");
    process.exit(1);
  }

  console.log("🔄 Starting token update process...");
  console.log(`Target: ${telegramId}/${shopName}`);
  console.log(`New token: ${newToken.substring(0, 20)}...`);

  updateTokenInSpecificDatabase(newToken, telegramId, shopName)
    .then(() => {
      console.log("\n✨ Token update completed successfully!");
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error.message);
      process.exit(1);
    });
}
