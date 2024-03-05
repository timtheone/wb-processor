import { Hono } from "hono";
import { simulateDelay } from "./utils/delay";
import { cors } from "hono/cors";
import { extractFromBody } from "../utils/extractTokenFromBody";
import { productCards } from "../db/schema";
import { inArray, sql } from "drizzle-orm";
import { createOrOpenDatabase } from "../db/createDb";
import puppeteer from "puppeteer";
import { ViewTest } from "./pdfCreator/View";

const WB_AP_URL = "https://suppliers-api.wildberries.ru/";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
  })
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

const getLastSupply = async (
  token: string,
  getDone = true,
  next = 0,
  limit = 200
): Promise<Supply> => {
  const response = await fetch(
    `${WB_AP_URL}/api/v3/supplies?limit=${limit}&next=${next}`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  );

  const jsonData = await response.json();

  if (jsonData.supplies.length === limit) {
    // Return the result of the recursive call
    return await getLastSupply(token, getDone, jsonData.next);
  } else {
    const filteredSupplies = (jsonData.supplies as Supply[]).filter((supply) =>
      getDone ? supply.done : !supply.done
    );
    // Return the last done supply

    console.log("filteredSupplies", filteredSupplies);
    return getDone
      ? filteredSupplies[filteredSupplies.length - 2]
      : filteredSupplies[filteredSupplies.length - 1];
  }
};

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

  const response = await fetch(`${WB_AP_URL}/content/v2/get/cards/list`, {
    headers: {
      Authorization: token,
    },
    method: "POST",
    body: JSON.stringify(buildBody()),
  }).then((data) => data.json());

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

export async function addOrdersToSupplyReal(
  supplyId: string,
  orderIds: number[],
  token: string
): Promise<void> {
  const results = await Promise.all(
    orderIds.map((orderId) =>
      fetch(`${WB_AP_URL}/api/v3/supplies/${supplyId}/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          Authorization: `${token}`,
        },
      })
    )
  );

  results.forEach((result) => {
    if (!result.ok) {
      throw new Error("Failed to add order to supply");
    }
  });
}

const createOrderListPdf = async ({
  itemsIds,
  supplyId,
  userId,
  dbName,
}: {
  itemsIds: number[];
  supplyId: string;
  userId: number;
  dbName: string;
}) => {
  const db = await createOrOpenDatabase(dbName, userId);

  const response = await db.query.productCards.findMany({
    where: inArray(productCards.id, itemsIds),
  });

  const htmlContent = <ViewTest data={response} supplyId={supplyId} />;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent.toString());
  const pdfBuffer = await page.pdf({ format: "A4" });

  await browser.close();

  return pdfBuffer;
};

type Supply = {
  closedAt: string;
  scanDt: string;
  id: string;
  name: string;
  createdAt: string;
  cargoType: number;
  done: boolean;
};

app.post("get_previous_code", async (c) => {
  const token = await extractFromBody(c.req, "token");

  const lastSupply = await getLastSupply(token);

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${lastSupply.id}/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return c.json(barCode);
});

app.post("/process-orders", async (c) => {
  const token = await extractFromBody(c.req, "token");

  const lastNotDoneSupply = await getLastSupply(token, false);
  let supply;

  if (!lastNotDoneSupply) {
    /* 
     Создаем поставку
   */
    supply = await fetch(`${WB_AP_URL}/api/v3/supplies`, {
      method: "POST",
      headers: {
        Authorization: `${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Тестовая поставка от Тимура2",
      }),
    }).then((data) => data.json());
  } else {
    supply = lastNotDoneSupply;
  }

  console.log("supply", supply);
  /*
      Получаем новые заказы
    */
  const orders = await fetch(`${WB_AP_URL}/api/v3/orders/new`, {
    method: "GET",
    headers: {
      Authorization: `${token}`,
    },
  }).then((data) => data.json());

  console.log("orders", orders);
  const ordersIds = orders.orders.map((order: any) => order.id);

  //   /*
  //     Добавляем заказы к поставке
  //   */
  await addOrdersToSupplyReal(supply.id, ordersIds, token);

  await simulateDelay(1000);

  //   // Put to delivery
  const response = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${supply.id}/deliver`,
    {
      method: "PATCH",
      headers: {
        Authorization: `${token}`,
      },
    }
  );

  await simulateDelay(1000);

  if (response.status >= 200 && response.status < 300) {
    const barCode = await fetch(
      `${WB_AP_URL}/api/v3/supplies/${supply.id}/barcode?type=png`,
      {
        headers: {
          Authorization: `${token}`,
        },
      }
    ).then((data) => data.json());

    return barCode;
  }
});

app.post("/get-order-list-pdf", async (c) => {
  const token = await extractFromBody(c.req, "token");
  const dbname = await extractFromBody(c.req, "dbname");
  const telegramId = await extractFromBody(c.req, "telegramId");
  const supplyId = await extractFromBody(c.req, "supplyId");

  const ordersOfSupply = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${supplyId}/orders`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  console.log("ordersOfSupply", ordersOfSupply);

  const itemsIds = ordersOfSupply.orders.map((order: any) => order.nmId);

  const pdfBuffer = await createOrderListPdf({
    itemsIds,
    supplyId,
    userId: telegramId,
    dbName: dbname,
  });

  return c.body(pdfBuffer, 200, { "Content-Type": "application/pdf" });
});

app.post("/getMock", async (c) => {
  const token = await extractFromBody(c.req, "token");

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/WB-GI-77468523/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return c.json(barCode);
});

app.post("/syncDB", async (c) => {
  const token = await extractFromBody(c.req, "token");
  const dbName = await extractFromBody(c.req, "dbname");
  const telegramId = await extractFromBody(c.req, "telegramId");
  const dbNameRegex = /^[a-z0-9-_]+$/;

  const isDbNameValid = dbNameRegex.test(dbName);

  if (!isDbNameValid) {
    return c.json("Некоректное имя базы данных");
  }

  const db = await createOrOpenDatabase(dbName, telegramId);

  const cards = await getProductCards({
    token,
    limit: 1000,
  });

  const transformedData = cards.map((card) => ({
    id: card.nmID,
    vendorCode: card.vendorCode,
    brand: card.brand,
    title: card.title,
    img: card.photos[0].big,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  }));

  const dbInsertResponse = await db
    .insert(productCards)
    .values(transformedData)
    .onConflictDoUpdate({
      target: productCards.id,
      set: {
        vendorCode: sql`EXCLUDED.vendorCode`,
        brand: sql`EXCLUDED.brand`,
        title: sql`EXCLUDED.title`,
        img: sql`EXCLUDED.img`,
        updatedAt: sql`EXCLUDED.updatedAt`,
        createdAt: sql`EXCLUDED.createdAt`,
      },
      where: sql`productCards.updatedAt < EXCLUDED.updatedAt`,
    })
    .returning({ insertedId: productCards.id });

  if (dbInsertResponse.length > 0) {
    return c.json(
      `Синхронизация прошла успешно, добавлено/обновлено ${dbInsertResponse.length} карточек товаров`
    );
  }
  return c.json("Новых карточек не обнаружено");
});

export default app;
