import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { extractFromBody } from "../utils/extractTokenFromBody";
import { productCards } from "../db/schema";
import { inArray, sql } from "drizzle-orm";
import { createOrOpenDatabase } from "../db/createDb";
import puppeteer from "puppeteer";

import { ViewCombined } from "./pdfCreator/ViewCombined";
import { Stickers } from "./pdfCreator/Stickers";
import { performDbSync } from "./utils/performDbSync";

let browserInstance = null;

async function getBrowserInstance() {
  if (browserInstance === null || !(await isBrowserOpen(browserInstance))) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const pid = await browserInstance.process()?.pid;
    console.log(`Browser instance created with pid: ${pid}`);
  }
  return browserInstance;
}

async function isBrowserOpen(browser) {
  try {
    const version = await browser.version();
    return Boolean(version);
  } catch (e) {
    return false;
  }
}

async function closeBrowserInstance() {
  if (browserInstance !== null) {
    await browserInstance.close();
    browserInstance = null;
  }
}

async function shutdown() {
  console.log("Shutting down browser instance");
  await closeBrowserInstance();
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
  })
);

app.use(async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    const sizeInBytes = parseInt(contentLength, 10);
    const sizeInMegabytes = sizeInBytes / (1024 * 1024); // Convert bytes to MB
    console.log(`Request size: ${sizeInMegabytes.toFixed(2)} MB`);
    console.log(`Raw request size: ${sizeInBytes} bytes`);
  }
  await next();
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

type ShopsPayload = {
  token: string;
  dbname: string;
  telegramId: string;
  supplyIds: string[];
};

type Order = {
  user: string | null;
  orderUid: string;
  article: string;
  rid: string;
  createdAt: string;
  offices: string[];
  skus: string[];
  id: string;
  warehouseId: number;
  nmId: number;
  chrtId: number;
  price: number;
  convertedPrice: number;
  currencyCode: number;
  convertedCurrencyCode: number;
  cargoType: number;
};

type OrdersOfSupplyOfShopsEnriched = {
  [key: string]: { orders: Array<Order & { stickers: any }>; supplyId: string };
};

async function getCombinedOrderAndStickerList(shops: ShopsPayload[]) {
  function chunkArray(array: number[], size: number) {
    const chunked_arr = [];
    for (let i = 0; i < array.length; i += size) {
      chunked_arr.push(array.slice(i, i + size));
    }
    return chunked_arr;
  }

  async function fetchStickers(token: string, orderIds: number[]) {
    const batchSize = 100;
    const batches = chunkArray(orderIds, batchSize);
    const allStickers = [];

    for (const batch of batches) {
      const response = await fetch(
        `${Bun.env.WB_AP_URL}/api/v3/orders/stickers?type=svg&width=58&height=40`,
        {
          method: "POST",
          headers: {
            Authorization: `${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orders: batch,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `Failed to fetch stickers for batch: ${response.status} ${response.statusText}`
        );
        continue; // Skip this batch or handle error appropriately
      }

      const batchStickers = await response.json();
      allStickers.push(...batchStickers.stickers); // Assuming API response structure
    }

    return allStickers;
  }

  const groupedOrders = new Map();

  await Promise.all(
    shops.map(async (shop) => {
      await Promise.all(
        shop.supplyIds.map(async (id) => {
          // Fetch orders for each supply ID
          const response = await fetch(
            `${Bun.env.WB_AP_URL}/api/v3/supplies/${id}/orders`,
            {
              headers: {
                Authorization: `${shop.token}`,
              },
            }
          );
          const orders = await response.json();

          // Get order IDs from the orders
          const orderIds = orders.orders.map((order) => order.id);

          // Fetch stickers for the orders
          const stickers = await fetchStickers(shop.token, orderIds);

          // Enrich orders with stickers data
          const enrichedOrders = orders.orders.map((order) => ({
            ...order,
            stickers:
              stickers.find((sticker) => sticker.orderId === order.id) || null,
          }));

          // Collect the enriched orders grouped by dbname
          const existingEntries = groupedOrders.get(shop.dbname) || [];
          existingEntries.push({
            orders: enrichedOrders,
            supplyId: id,
            telegramId: shop.telegramId,
          });
          groupedOrders.set(shop.dbname, existingEntries);
        })
      );
    })
  );

  const ordersOfSupplyOfShops = Array.from(groupedOrders).map(
    ([key, value]) => ({
      [key]: value,
    })
  );

  const flattenedData: OrdersOfSupplyOfShopsEnriched[] =
    ordersOfSupplyOfShops.flat();
  return flattenedData;
}

const getProductCards = async ({
  token,
  limit,
  updatedAt,
  nmID,
}: {
  token: string;
  limit: number;
  updatedAt?: string;
  nmID?: number;
}) => {
  const buildBody = () => {
    const body = {
      settings: {
        cursor: {
          limit,
        },
        filter: {
          withPhoto: 1,
        },
      },
    };

    // Note: Updated to cursor for both updatedAt and nmID as per your latest code
    if (updatedAt) {
      body.settings.cursor.updatedAt = updatedAt;
    }

    if (nmID) {
      body.settings.cursor.nmID = nmID;
    }

    return body;
  };

  const response = await fetch(
    `${Bun.env.WB_AP_URL}/content/v2/get/cards/list`,
    {
      headers: {
        Authorization: token,
      },
      method: "POST",
      body: JSON.stringify(buildBody()),
    }
  ).then((data) => data.json());

  // Initialize completeData with response.cards or an empty array if it's undefined
  let completeData = response.cards || [];

  if (response.cards && response.cards.length === limit) {
    // Make a recursive call if the condition is met
    const response2 = await getProductCards({
      token,
      limit,
      updatedAt: response.cursor ? response.cursor.updatedAt : undefined,
      nmID: response.cursor ? response.cursor.nmID : undefined,
    });

    // Ensure response2 is an array before concatenating
    if (Array.isArray(response2) && response2.length > 0) {
      completeData = completeData.concat(response2);
    }
  }

  return completeData;
};

const createOrderListForShopsCombinedPdf = async ({
  data,
  file,
}: {
  data: OrdersOfSupplyOfShopsEnriched[];
  file: "orderList" | "stickers";
}) => {
  console.log("pdf-generation started");
  const dbs = await Promise.all(
    data.map((shopObject) => {
      // Each shopObject has one key-value pair, the key being the dbname and value being the array of order details
      const dbname = Object.keys(shopObject)[0];
      const telegramId = shopObject[dbname][0].telegramId; // Assuming the telegramId is the same for all entries in a shop

      return createOrOpenDatabase(dbname, telegramId);
    })
  );
  const responses = await Promise.all(
    data.map((shopObject, index) => {
      const dbname = Object.keys(shopObject)[0];
      const db = dbs[index];

      // Create nmId to multiple orders map
      const ordersMap = new Map();
      shopObject[dbname].forEach((shop) =>
        shop.orders.forEach((order) => {
          if (!ordersMap.has(order.nmId)) {
            ordersMap.set(order.nmId, []);
          }
          if (!order.stickers) {
            console.log("order", order);
          }
          ordersMap
            .get(order.nmId)
            .push({ orderId: order.id, stickers: order.stickers });
        })
      );

      // Extract unique itemIds from all orders within the current shop
      const uniqueItemIds = Array.from(ordersMap.keys());

      // Perform database query for the extracted unique itemIds
      return db.query.productCards
        .findMany({
          where: inArray(productCards.id, uniqueItemIds),
        })
        .then((products) => {
          // For each product, create entries for each order linked to it
          const enrichedProducts = [];
          products.forEach((product) => {
            const orders = ordersMap.get(product.id);
            if (orders) {
              orders.forEach((order) => {
                enrichedProducts.push({
                  ...product,
                  stickers: order.stickers,
                  orderId: order.orderId,
                });
              });
            }
          });
          return enrichedProducts;
        });
    })
  );

  // Flatten and sort the final responses
  const flattenedSortedResponses = responses.flat().sort((a, b) => {
    if (a.title && b.title) {
      return a.title.localeCompare(b.title, "ru");
    } else if (a.title) {
      return -1; // Consider items with null titles as greater
    } else {
      return 1;
    }
  });

  if (file === "orderList") {
    const htmlContent = (
      <ViewCombined
        data={flattenedSortedResponses}
        supplyIds={data
          .map((shopObject, index) => {
            const dbname = Object.keys(shopObject)[0];

            // Extract itemIds from all orders within the current shop
            return shopObject[dbname].flatMap(
              (shop) => `${shop.supplyId} - ${shop.orders.length} Товаров`
            );
          })
          .flat()}
      />
    );

    try {
      const browser = await getBrowserInstance();
      const page = await browser.newPage();
      await page.setContent(htmlContent.toString(), {
        waitUntil: "networkidle0",
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "5mm",
          bottom: "5mm",
          left: "3mm",
          right: "5mm",
        },
      });

      return pdfBuffer;
    } catch (error) {
      throw new Error("Failed to create PDF");
    } finally {
      await shutdown();
    }

    // return htmlContent;
  } else {
    console.log("backend stickers generation started");
    const stickers = flattenedSortedResponses
      .map((response) => {
        if (!response.stickers) {
          console.log("response", response);
        }
        return {
          file: response.stickers.file,
        };
      })
      .flat();

    // console.log("stickers length", stickers.length);

    const stickersHtml = <Stickers data={stickers} />;

    try {
      const browser = await getBrowserInstance();
      const pageStickers = await browser.newPage();
      await pageStickers.setContent(stickersHtml.toString(), {
        timeout: 0,
        waitUntil: "networkidle0",
      });
      console.log("setting content finished");
      const stickersHtmlBuffer = await pageStickers.pdf({
        width: "1.57in",
        height: "1.18in",
      });

      console.log("pdf created");

      return stickersHtmlBuffer;
    } catch (error) {
      console.error("error", error);
      throw new Error("Failed to create stickers PDF");
    } finally {
      await shutdown();
    }
    // return stickersHtml;
  }
};

app.post(
  "/get-order-list-pdf-combined-shops",
  bodyLimit({
    maxSize: 1024 * 1024 * 200, // 50kb
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  async (c) => {
    const shops: ShopsPayload[] = await extractFromBody(c.req, "shops");

    console.log("shops request", shops);

    const flattenedData: OrdersOfSupplyOfShopsEnriched[] =
      await getCombinedOrderAndStickerList(shops);

    const fileBuffer = await createOrderListForShopsCombinedPdf({
      data: flattenedData,
      file: "orderList",
    });

    console.log("fileBufer", fileBuffer.length);

    return c.body(fileBuffer, 200, { "Content-Type": "application/pdf" });
    // return c.html(fileBuffer);
  }
);

app.post(
  "/get-stickers-list-pdf-combined-shops",
  bodyLimit({
    maxSize: 1024 * 1024 * 200, // 50kb
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  async (c) => {
    console.log("get-stickers-list-pdf-combined-shops calling");
    const shops: ShopsPayload[] = await extractFromBody(c.req, "shops");

    const flattenedData: OrdersOfSupplyOfShopsEnriched[] =
      await getCombinedOrderAndStickerList(shops);

    const fileBuffer = await createOrderListForShopsCombinedPdf({
      data: flattenedData,
      file: "stickers",
    });

    return c.body(fileBuffer, 200, { "Content-Type": "application/pdf" });
    // return c.html(fileBuffer);
  }
);

app.post("/syncDB", async (c) => {
  const token = await extractFromBody(c.req, "token");
  const dbName = await extractFromBody(c.req, "dbname");
  const telegramId = await extractFromBody(c.req, "telegramId");
  const dbNameRegex = /^[a-zA-Z0-9-_]+$/;

  const isDbNameValid = dbNameRegex.test(dbName);

  if (!isDbNameValid) {
    return c.json("Некоректное имя базы данных");
  }

  const dbInsertResponse = await performDbSync(dbName, telegramId, token);

  if (dbInsertResponse.length > 0) {
    return c.json(
      `Синхронизация прошла успешно, добавлено/обновлено ${dbInsertResponse.length} карточек товаров`
    );
  }
  return c.json("Новых карточек не обнаружено");
});

new Worker(new URL("./jobs/dbSyncJob.ts", import.meta.url).href);

console.log("Server started at", new Date().toISOString());

export default app;
