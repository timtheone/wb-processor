import { Hono } from "hono";
import { createSupply } from "./mock/createSupply";
import { retreiveNewOrders } from "./mock/retrieveOrders";
import { addOrdersToSupply } from "./mock/addOrdersToSupply";
import { deliverSupply } from "./mock/deliverSupply";
import { getBarCode } from "./mock/getBarCode";
import { simulateDelay } from "./mock/utils/delay";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

const WB_AP_URL = "https://suppliers-api.wildberries.ru/";
const TOKEN =
  "eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjMxMjI1djEiLCJ0eXAiOiJKV1QifQ.eyJlbnQiOjEsImV4cCI6MTcyMzg2MTc1OSwiaWQiOiJiYWI1ODVhZi03MzJmLTRjYWEtYTk2Yi1kYTY1ZWJiMGI2OWQiLCJpaWQiOjM4ODY2NTYwLCJvaWQiOjExOTc4OTQsInMiOjUxMCwic2lkIjoiYjZjYmZmNWEtNjVkYi00OTU1LWE2NjgtZWNiOTA1YmQ2ZDQ3IiwidCI6ZmFsc2UsInVpZCI6Mzg4NjY1NjB9.UD0d1q2wTIVp8QPm9oq0QtlygPmQPuEwRwp5s4twLt3a4aefF7GjZzZqZxBPZlgb8x_NwzpJOOj6mXr0T40OkA";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
  })
);

export async function addOrdersToSupplyReal(
  supplyId: string,
  orderIds: number[]
): Promise<void> {
  const results = await Promise.allSettled(
    orderIds.map((orderId) =>
      fetch(`${WB_AP_URL}/api/v3/supplies/${supplyId}/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          Authorization: `${TOKEN}`,
        },
      }).then((data) => data.json())
    )
  );

  console.log("results", results);

  // Assuming you want to filter out successfully added orders and return their IDs
  const successfulOrders = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => ({
      id: (result as PromiseFulfilledResult<{ id: number }>).value.id,
    }));

  // return successfulOrders;
}

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/process", async (c) => {
  const supply = await createSupply("Без названия");
  const orders = await retreiveNewOrders();
  const orderIds = orders.orders.map((order) => order.id);
  await addOrdersToSupply(supply.id, orderIds);
  await deliverSupply(supply.id);
  const barCode = await getBarCode(supply.id);
  // const imgBuffer = Buffer.from(barCode.file, "base64");

  // await Bun.write("./test.png", imgBuffer);

  return c.json(barCode);
});

app.post("get_previous_code", async (c) => {
  let body;

  const supplyId = "WB-GI-76329573";

  try {
    body = await c.req.json();
    if (!("token" in body)) {
      throw new Error("no_token");
    }
  } catch (error) {
    if (error instanceof Error && error.message == "no_token") {
      throw new HTTPException(400, {
        message: "Invalid request body, missing token",
      });
    }
    throw new HTTPException(400, { message: "Invalid request body" });
  }

  const getLastSupply = async (next = 0, limit = 200) => {
    const response = await fetch(
      `${WB_AP_URL}/api/v3/supplies?limit=${limit}&next=${next}`,
      {
        headers: {
          Authorization: `${body.token}`,
        },
      }
    );
    const jsonData = await response.json();
    if (jsonData.supplies.length === limit) {
      // Return the result of the recursive call
      return await getLastSupply(jsonData.next);
    } else {
      const doneSupplies = jsonData.supplies.filter((supply) => supply.done);
      // Return the last done supply
      return doneSupplies[doneSupplies.length - 2];
    }
  };

  const lastSupply = await getLastSupply();

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${lastSupply.id}/barcode?type=png`,
    {
      headers: {
        Authorization: `${body.token}`,
      },
    }
  ).then((data) => data.json());

  console.log("REAL_API");

  return c.json(barCode);
});

app.post("/process-orders", async (c) => {
  let body;

  try {
    body = await c.req.json();
    if (!("token" in body)) {
      throw new Error("no_token");
    }
  } catch (error) {
    if (error instanceof Error && error.message == "no_token") {
      throw new HTTPException(400, {
        message: "Invalid request body, missing token",
      });
    }
    throw new HTTPException(400, { message: "Invalid request body" });
  }

  const supplyId = "WB-GI-75841703";
  // const newSupply = await fetch(`${WB_AP_URL}/api/v3/supplies`, {
  //   method: "POST",
  //   headers: {
  //     Authorization: `${TOKEN}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     name: "Тестовая поставка от Тимура2",
  //   }),
  // }).then((data) => data.json());

  // const orders = await fetch(`${WB_AP_URL}/api/v3/orders/new`, {
  //   method: "GET",
  //   headers: {
  //     Authorization: `${TOKEN}`,
  //   },
  // }).then((data) => data.json());
  // const ordersIds = orders.orders.map((order: any) => order.id);
  // await addOrdersToSupplyReal(newSupply.id, ordersIds);

  await simulateDelay(1000);

  // Put to delivery
  // await fetch(`${WB_AP_URL}/api/v3/supplies/${supplyId}/deliver`, {
  //   method: "PATCH",
  //   headers: {
  //     Authorization: `${TOKEN}`,
  //   },
  // });

  await simulateDelay(1000);

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${supplyId}/barcode?type=png`,
    {
      headers: {
        Authorization: `${body.token}`,
      },
    }
  ).then((data) => data.json());

  console.log("REAL_API");

  return c.json(barCode);
  // return c.json(orders);
});

export default app;
