import { formatDate } from "../utils/formatDate";
import { trackedFetch } from "../../backend/src/utils/request-tracker";
type Supply = {
  closedAt: string;
  scanDt: string;
  id: string;
  name: string;
  createdAt: string;
  cargoType: number;
  done: boolean;
};

function simulateDelay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const MAX_RETRIES = 10; // Maximum number of retries

export const getLastTwoSupplyIds = async (token: string) => {
  const lastSupply = await getLastSupply(token, true, 0);
  const secondToLastSupply = await getLastSupply(token, true, 1);

  return { lastSupply, secondToLastSupply };
};

async function addOrdersToSupplyReal(
  supplyId: string,
  orderIds: number[],
  token: string,
  delayMs: number = 500
): Promise<void> {
  try {
    // Process orders strictly sequentially with delay
    const results = [];
    for (const orderId of orderIds) {
      try {
        const response = await trackedFetch(
          `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/${supplyId}/orders/${orderId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `${token}`,
            },
          }
        );

        const responseBody = await response.json();
        if (response.status < 200 || response.status >= 300) {
          throw new Error(JSON.stringify(responseBody));
        }
        results.push({
          status: "fulfilled",
          value: { response, orderId, responseBody },
        });

        // Add delay after each successful request (except the last one)
        if (orderId !== orderIds[orderIds.length - 1]) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      } catch (error) {
        results.push({ status: "rejected", reason: error });
      }
    }

    const errors: any[] = [];
    results.forEach((result) => {
      if (result.status === "rejected") {
        errors.push({
          type: "fetch_error",
          error: result.reason,
          timestamp: new Date().toISOString(),
        });
      }
    });

    if (errors.length > 0) {
      console.error("Errors occurred while adding orders to supply:", {
        supplyId,
        orderIds,
        errors,
        totalOrders: orderIds.length,
        failedOrders: errors.length,
        successfulOrders: orderIds.length - errors.length,
      });
      throw new Error(
        `Failed to add orders to supply. ${errors.length} orders failed.`
      );
    }
  } catch (error) {
    console.error("Fatal error in addOrdersToSupplyReal:", {
      supplyId,
      orderIds,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

const getLastSupply = async (
  token: string,
  getDone = true,
  offset = 1,
  next = 0,
  limit = 1000
): Promise<Supply | null> => {
  const response = await trackedFetch(
    `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies?limit=${limit}&next=${next}`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  );

  // console.log("getLastSupply response", response);

  const jsonData = await response.json();

  let allSupplies: Supply[] = [];

  if (jsonData.supplies.length === limit) {
    // Return the result of the recursive call
    const response = await trackedFetch(
      `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies?limit=${limit}&next=${jsonData.next}`,
      {
        headers: {
          Authorization: `${token}`,
        },
      }
    );

    const jsonDataPreCheck = await response.json();

    if (jsonDataPreCheck.supplies.length === 0) {
      allSupplies = [...allSupplies, ...jsonData.supplies];
    } else {
      const restOfSupplies = await getLastSupply(
        token,
        getDone,
        offset,
        jsonData.next,
        limit
      );
      return restOfSupplies ? restOfSupplies : null;
    }
  } else {
    allSupplies = [...allSupplies, ...jsonData.supplies];
  }

  const filteredSupplies = allSupplies.filter((supply) =>
    getDone ? supply.done : !supply.done
  );

  console.log("filteredSupplies", filteredSupplies.length);

  // Sort supplies by date
  const sortedSupplies = filteredSupplies.sort((a, b) => {
    const dateA = getDone ? new Date(a.closedAt) : new Date(a.createdAt);
    const dateB = getDone ? new Date(b.closedAt) : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  if (sortedSupplies.length === 0) {
    return null;
  }

  // Return the last or second to last supply based on date
  return getDone ? sortedSupplies[offset] || null : sortedSupplies[0] || null;
};

export const getLastSupplyQrCode = async (token: string) => {
  const lastSupply = await getLastSupply(token);

  const barCode = await fetch(
    `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/${lastSupply.id}/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return barCode;
};

export const processOrdersReal = async (token: string) => {
  /*
      Получаем новые заказы
    */
  const orders = await trackedFetch(
    `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/orders/new`,
    {
      method: "GET",
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  if (orders?.orders?.length < 1) {
    return {
      status: "no_orders",
      reason: "Процесс отменен, так как нет новых заказов",
    };
  }

  const ordersIds = orders?.orders?.map((order: any) => order.id);

  console.log("ordersIds", ordersIds);

  const lastNotDoneSupply = await getLastSupply(token, false);
  let supply;

  if (!lastNotDoneSupply) {
    /* 
     Создаем поставку
   */
    const newDate = new Date();
    supply = await trackedFetch(
      `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies`,
      {
        method: "POST",
        headers: {
          Authorization: `${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formatDate(newDate),
        }),
      }
    ).then((data) => data.json());
  } else {
    supply = lastNotDoneSupply;
  }

  await simulateDelay(2000);
  //   /*
  //     Добавляем заказы к поставке
  //   */
  console.log("Orders to add to supply started at:", new Date());
  await addOrdersToSupplyReal(supply.id, ordersIds, token);

  console.log("Orders added to supply ended at:", new Date());

  await simulateDelay(2000);

  console.log("Supply are getting send to delivery start at ", new Date());
  //   // Put to delivery

  let retryCountDelivery = 0;

  while (retryCountDelivery < MAX_RETRIES) {
    try {
      const deliverResponse = await trackedFetch(
        `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/${supply.id}/deliver`,
        {
          method: "PATCH",
          headers: {
            Authorization: `${token}`,
          },
        }
      );

      const json = await deliverResponse.json();

      console.log(`Deliver response on try ${retryCountDelivery}`, {
        status: deliverResponse.status,
        statusText: deliverResponse.statusText,
        json: json,
        supplyId: supply.id,
      });

      if (deliverResponse.status >= 200 && deliverResponse.status < 300) {
        break; // Exit the loop in case of success
      } else {
        retryCountDelivery++;
        console.log(
          `Retry #${retryCountDelivery}: Delivery not successful, retrying...`
        );
        await sleep(1000);
      }
    } catch (error) {
      console.error("Error sending the supply to deliver", error);
      break; // Exit the loop in case of an error
    }
  }

  console.log("Supply are getting send to delivery end at ", new Date());

  await simulateDelay(1000);

  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      let localSupply = await fetchSupplyData(supply.id, token);
      console.log("retryCount", retryCount);
      if (localSupply.done) {
        const barCodeResponse = await trackedFetch(
          `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/${supply.id}/barcode?type=png`,
          {
            headers: {
              Authorization: `${token}`,
            },
          }
        );
        const barCode = await barCodeResponse.json();
        return barCode; // Successfully fetched barcode, return it
      } else {
        // supply.done is false, increase retryCount and try again
        retryCount++;
        console.log(`Retry #${retryCount}: Supply not ready, retrying...`);
        await sleep(1000);
      }
    } catch (error) {
      console.error("Error fetching supply or barcode:", error);
      break; // Exit the loop in case of an error
    }
  }

  if (retryCount === MAX_RETRIES) {
    console.error("Max retries reached without success.");
  }
};

export const getMock = async (token: string) => {
  const barCode = await fetch(
    `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/WB-GI-77468523/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return barCode;
};

async function fetchSupplyData(supplyId: string, token: string) {
  const response = await trackedFetch(
    `${Bun.env.WB_API_URL_MARKETPLACE}/api/v3/supplies/${supplyId}`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  );
  if (response.status >= 200 && response.status < 300) {
    const supply = await response.json();
    return supply;
  } else {
    throw new Error(`Failed to fetch supply data: ${response.statusText}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
