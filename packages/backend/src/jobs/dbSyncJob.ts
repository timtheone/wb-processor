// Import the Cron library; make sure it's installed in your environment
import { Cron } from "croner";
import { performDbSync } from "../utils/performDbSync";
import { getDbNamespaceAndNameMap, getDbs } from "../../db/getDbs";

async function runTaskWithRetry2(maxRetries: number) {
  let attempts = 0;
  console.log("Task started");

  const dbs = await getDbNamespaceAndNameMap();

  function attempt() {
    const syncPromises = [];
    for (const [namespace, dbNames] of dbs.entries()) {
      for (const dbName of dbNames) {
        // Create a promise for each database sync and add it to the list
        syncPromises.push(performDbSync(dbName, namespace));
      }
    }

    Promise.all(syncPromises)
      .then(() => {
        console.log("Database sync completed successfully.");
      })
      .catch((error) => {
        console.log("Attempt failed:", error);
        if (attempts++ < maxRetries) {
          setTimeout(() => {
            console.log(`Retrying... Attempt ${attempts}`);
            attempt();
          }, 1000); // Retry after 1 second
        } else {
          console.log("Max retries reached, giving up.");
        }
      });
  }

  attempt();
}

// Set up the Cron job in the worker
new Cron("0 3 * * *", () => {
  runTaskWithRetry2(3);
});

// new Cron("*/30 * * * * *", async () => {
//   await runTaskWithRetry2(3);
// });
