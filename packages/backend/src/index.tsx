/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { extractFromBody } from "../utils/extractTokenFromBody";
import { productCards } from "../db/schema";
import { inArray } from "drizzle-orm";
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
      protocolTimeout: 600000, // 10 minutes for large PDFs
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--no-zygote",
      ],
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
  id: number;
  nmId: number;
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
        `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders/stickers?type=svg&width=58&height=40`,
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
        console.error(`Failed order ids: ${batch.join(", ")}`);
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
      // Fetch orders for the last 5 days with pagination
      // Reduced from 10 to 5 to avoid Telegram 413 errors with large PDFs
      const dateFrom = Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60; // 5 days ago
      const allOrders: any[] = [];
      let nextCursor = 0;

      // Keep fetching until we have all orders (pagination)
      do {
        const allOrdersResponse = await fetch(
          `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders?limit=1000&next=${nextCursor}&dateFrom=${dateFrom}`,
          {
            headers: {
              Authorization: `${shop.token}`,
            },
          }
        );

        if (!allOrdersResponse.ok) {
          console.error(
            `[Shop ${shop.dbname}] API Error ${allOrdersResponse.status}`
          );
          const errorData = await allOrdersResponse.json();
          console.error(`[Shop ${shop.dbname}] Error details:`, errorData);
          break;
        }

        const allOrdersData = await allOrdersResponse.json();
        const orders = allOrdersData.orders || [];

        if (orders.length > 0) {
          allOrders.push(...orders);
        }

        // Check if there are more pages
        nextCursor = allOrdersData.next;

        // Break if no more pages or we got less than the limit
        if (!nextCursor || orders.length < 1000) {
          break;
        }
      } while (true);

      // Create a map of orderId -> order data for quick lookup
      const orderDetailsMap = new Map<number, { id: number; nmId: number }>(
        allOrders.map((order: any) => [
          order.id,
          { id: order.id, nmId: order.nmId },
        ])
      );

      await Promise.all(
        shop.supplyIds.map(async (id) => {
          // Fetch order IDs for this supply using the new endpoint
          const response = await fetch(
            `${Bun.env.WB_API_URL_MARKETPLACE}/api/marketplace/v3/supplies/${id}/order-ids`,
            {
              headers: {
                Authorization: `${shop.token}`,
              },
            }
          );
          const orderIdsData = await response.json();
          const orderIds = orderIdsData.orderIds || [];

          // Fetch stickers for the orders
          const stickers = await fetchStickers(shop.token, orderIds);

          // Enrich orders with stickers data and nmId from the full orders list
          const enrichedOrders = orderIds
            .map((orderId: number) => {
              const orderDetails = orderDetailsMap.get(orderId);
              if (!orderDetails) {
                return null;
              }
              return {
                id: orderDetails.id,
                nmId: orderDetails.nmId,
                stickers:
                  stickers.find((sticker) => sticker.orderId === orderId) ||
                  null,
              };
            })
            .filter(
              (order): order is Order & { stickers: any } => order !== null
            ); // Remove null entries

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

  // Log total order count for monitoring
  const totalOrders = flattenedData.reduce((sum, shop) => {
    const shopData = Object.values(shop)[0];
    if (Array.isArray(shopData)) {
      return (
        sum +
        shopData.reduce((s, supply) => s + (supply.orders?.length || 0), 0)
      );
    }
    return sum;
  }, 0);

  console.log(`Total orders fetched: ${totalOrders}`);

  // Telegram has a file size limit, warn if we might exceed it
  if (totalOrders > 500) {
    console.warn(
      `⚠️  Large order count (${totalOrders}). PDF might be too large for Telegram!`
    );
  }

  return flattenedData;
}

async function getCombinedOrderAndStickerListWithStatusFilter(
  shops: ShopsPayload[]
) {
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
        `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders/stickers?type=svg&width=58&height=40`,
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
        console.error(`Failed order ids: ${batch.join(", ")}`);
        continue;
      }

      const batchStickers = await response.json();
      allStickers.push(...batchStickers.stickers);
    }

    return allStickers;
  }

  async function fetchOrderStatuses(token: string, orderIds: number[]) {
    const batchSize = 1000;
    const batches = chunkArray(orderIds, batchSize);
    const allStatuses = [];

    for (const batch of batches) {
      const response = await fetch(
        `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders/status`,
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
          `Failed to fetch order statuses for batch: ${response.status} ${response.statusText}`
        );
        console.error(`Failed order ids: ${batch.join(", ")}`);
        continue;
      }

      const batchStatuses = await response.json();
      allStatuses.push(...batchStatuses.orders);
    }

    return allStatuses;
  }

  const groupedOrders = new Map();

  await Promise.all(
    shops.map(async (shop) => {
      // Fetch orders for the last 30 days with pagination
      // Increased from 5 to 30 to ensure we get all orders from the last 6 supplies
      const dateFrom = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
      const allOrders: any[] = [];
      let nextCursor = 0;

      // Keep fetching until we have all orders (pagination)
      do {
        const allOrdersResponse = await fetch(
          `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders?limit=1000&next=${nextCursor}&dateFrom=${dateFrom}`,
          {
            headers: {
              Authorization: `${shop.token}`,
            },
          }
        );

        if (!allOrdersResponse.ok) {
          console.error(
            `[Shop ${shop.dbname}] API Error ${allOrdersResponse.status}`
          );
          const errorData = await allOrdersResponse.json();
          console.error(`[Shop ${shop.dbname}] Error details:`, errorData);
          break;
        }

        const allOrdersData = await allOrdersResponse.json();
        const orders = allOrdersData.orders || [];

        if (orders.length > 0) {
          allOrders.push(...orders);
        }

        nextCursor = allOrdersData.next;

        if (!nextCursor || orders.length < 1000) {
          break;
        }
      } while (true);

      // Create a map of orderId -> order data for quick lookup (with createdAt for waiting orders)
      const orderDetailsMap = new Map<
        number,
        { id: number; nmId: number; createdAt: string }
      >(
        allOrders.map((order: any) => [
          order.id,
          { id: order.id, nmId: order.nmId, createdAt: order.createdAt },
        ])
      );

      await Promise.all(
        shop.supplyIds.map(async (id) => {
          // Fetch order IDs for this supply using the new endpoint
          const response = await fetch(
            `${Bun.env.WB_API_URL_MARKETPLACE}/api/marketplace/v3/supplies/${id}/order-ids`,
            {
              headers: {
                Authorization: `${shop.token}`,
              },
            }
          );
          const orderIdsData = await response.json();
          const orderIds = orderIdsData.orderIds || [];

          // Fetch order statuses
          const orderStatuses = await fetchOrderStatuses(shop.token, orderIds);

          // Create a map of orderId -> wbStatus
          const statusMap = new Map<number, string>(
            orderStatuses.map((status: any) => [status.id, status.wbStatus])
          );

          // Filter orderIds to only include those with wbStatus === "waiting"
          const waitingOrderIds = orderIds.filter((orderId: number) => {
            const wbStatus = statusMap.get(orderId);
            return wbStatus === "waiting";
          });

          console.log(
            `[Shop ${shop.dbname}] Supply ${id}: ${orderIds.length} total orders, ${waitingOrderIds.length} waiting orders`
          );

          // If no waiting orders, skip this supply
          if (waitingOrderIds.length === 0) {
            return;
          }

          // Fetch stickers only for waiting orders
          const stickers = await fetchStickers(shop.token, waitingOrderIds);

          // Enrich orders with stickers data, nmId, and createdAt from the full orders list
          const enrichedOrders = waitingOrderIds
            .map((orderId: number) => {
              const orderDetails = orderDetailsMap.get(orderId);
              if (!orderDetails) {
                console.warn(
                  `[Shop ${shop.dbname}] Supply ${id}: Order ${orderId} not found in orderDetailsMap (might be older than 30 days)`
                );
                return null;
              }
              return {
                id: orderDetails.id,
                nmId: orderDetails.nmId,
                createdAt: orderDetails.createdAt,
                stickers:
                  stickers.find((sticker) => sticker.orderId === orderId) ||
                  null,
              };
            })
            .filter(
              (order): order is Order & { stickers: any; createdAt: string } =>
                order !== null
            );

          console.log(
            `[Shop ${shop.dbname}] Supply ${id}: ${waitingOrderIds.length} waiting orders, ${enrichedOrders.length} enriched successfully`
          );

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

  // Log total order count for monitoring
  const totalOrders = flattenedData.reduce((sum, shop) => {
    const shopData = Object.values(shop)[0];
    if (Array.isArray(shopData)) {
      return (
        sum +
        shopData.reduce((s, supply) => s + (supply.orders?.length || 0), 0)
      );
    }
    return sum;
  }, 0);

  console.log(`Total waiting orders fetched: ${totalOrders}`);

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
    `${Bun.env.WB_API_URL_CONTENT}/content/v2/get/cards/list`,
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
  isWaitingOrdersOnly = false,
}: {
  data: OrdersOfSupplyOfShopsEnriched[];
  file: "orderList" | "stickers";
  isWaitingOrdersOnly?: boolean;
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

      // Create nmId to multiple orders map (include createdAt for waiting orders PDF)
      const ordersMap = new Map();
      shopObject[dbname].forEach((shop) =>
        shop.orders.forEach((order: any) => {
          if (!ordersMap.has(order.nmId)) {
            ordersMap.set(order.nmId, []);
          }
          if (!order.stickers) {
            console.log("order", order);
          }
          ordersMap.get(order.nmId).push({
            orderId: order.id,
            stickers: order.stickers,
            createdAt: order.createdAt, // Include createdAt for waiting orders
          });
        })
      );

      // Extract unique itemIds from all orders within the current shop
      const uniqueItemIds = Array.from(ordersMap.keys());

      // If no orders, return empty array
      if (uniqueItemIds.length === 0) {
        console.warn(`No orders found for shop ${dbname}`);
        return Promise.resolve([]);
      }

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
              orders.forEach((order: any) => {
                enrichedProducts.push({
                  ...product,
                  stickers: order.stickers,
                  orderId: order.orderId,
                  createdAt: order.createdAt, // Include createdAt for waiting orders
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
            return shopObject[dbname].flatMap((shop) =>
              isWaitingOrdersOnly
                ? `${shop.supplyId} - ${shop.orders.length} Товаров (ожидающие)`
                : `${shop.supplyId} - ${shop.orders.length} Товаров`
            );
          })
          .flat()}
        headerTitle={
          isWaitingOrdersOnly
            ? "Листы подбора (только ожидающие заказы):"
            : "Листы подбора:"
        }
        isWaitingOrdersOnly={isWaitingOrdersOnly}
      />
    );

    try {
      const browser = await getBrowserInstance();
      const page = await browser.newPage();
      await page.setContent(htmlContent.toString(), {
        waitUntil: "networkidle0",
        timeout: 600000, // 10 minutes for large PDFs
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
        timeout: 600000, // 10 minutes for large PDFs
      });

      // Check file size (Telegram limit is 50MB)
      const fileSizeInMB = pdfBuffer.length / (1024 * 1024);
      console.log(`Order list PDF size: ${fileSizeInMB.toFixed(2)} MB`);

      if (fileSizeInMB > 50) {
        console.error(
          `⚠️  PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) exceeds Telegram's 50MB limit!`
        );
        throw new Error(
          `PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) exceeds Telegram's 50MB limit. Please reduce the number of orders.`
        );
      } else if (fileSizeInMB > 45) {
        console.warn(
          `⚠️  PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) is close to Telegram's 50MB limit!`
        );
      }

      await page.close();

      return pdfBuffer;
    } catch (error) {
      console.error("error", error);
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

      await pageStickers.setJavaScriptEnabled(false); // If you don't need JS

      await pageStickers.setContent(stickersHtml.toString(), {
        timeout: 600000, // Set explicit timeout of 10 minutes for large PDFs
        waitUntil: "domcontentloaded",
      });
      console.log("setting content finished");
      const stickersHtmlBuffer = await pageStickers.pdf({
        width: "1.57in",
        height: "1.18in",
        timeout: 600000, // Increased to 10 minutes
      });

      console.log("pdf created");

      // Check file size (Telegram limit is 50MB)
      const fileSizeInMB = stickersHtmlBuffer.length / (1024 * 1024);
      console.log(`Stickers PDF size: ${fileSizeInMB.toFixed(2)} MB`);

      if (fileSizeInMB > 50) {
        console.error(
          `⚠️  PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) exceeds Telegram's 50MB limit!`
        );
        throw new Error(
          `PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) exceeds Telegram's 50MB limit. Please reduce the number of orders.`
        );
      } else if (fileSizeInMB > 45) {
        console.warn(
          `⚠️  PDF size (${fileSizeInMB.toFixed(
            2
          )} MB) is close to Telegram's 50MB limit!`
        );
      }

      await pageStickers.close();

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

app.post(
  "/get-waiting-order-list-pdf-combined-shops",
  bodyLimit({
    maxSize: 1024 * 1024 * 200,
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  async (c) => {
    const shops: ShopsPayload[] = await extractFromBody(c.req, "shops");

    console.log("shops request for waiting orders", shops);

    const flattenedData: OrdersOfSupplyOfShopsEnriched[] =
      await getCombinedOrderAndStickerListWithStatusFilter(shops);

    const fileBuffer = await createOrderListForShopsCombinedPdf({
      data: flattenedData,
      file: "orderList",
      isWaitingOrdersOnly: true,
    });

    return c.body(fileBuffer, 200, { "Content-Type": "application/pdf" });
  }
);

app.post(
  "/get-waiting-stickers-list-pdf-combined-shops",
  bodyLimit({
    maxSize: 1024 * 1024 * 200,
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  async (c) => {
    console.log("get-waiting-stickers-list-pdf-combined-shops calling");
    const shops: ShopsPayload[] = await extractFromBody(c.req, "shops");

    const flattenedData: OrdersOfSupplyOfShopsEnriched[] =
      await getCombinedOrderAndStickerListWithStatusFilter(shops);

    const fileBuffer = await createOrderListForShopsCombinedPdf({
      data: flattenedData,
      file: "stickers",
      isWaitingOrdersOnly: true,
    });

    return c.body(fileBuffer, 200, { "Content-Type": "application/pdf" });
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
