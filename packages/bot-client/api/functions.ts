import { formatDate } from "../utils/formatDate";

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

const WB_AP_URL = "https://suppliers-api.wildberries.ru/";
const MAX_RETRIES = 10; // Maximum number of retries

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

  results.forEach((result, index) => {
    if (result.status < 200 && result.status > 300) {
      console.error(
        `Failed to add order ${
          orderIds[index]
        } to supply ${supplyId} at ${new Date()}`
      );
    }
  });

  const allSuccessful = results.every(
    (result) => result.status >= 200 && result.status < 300
  );

  console.log("All successful:", new Date());

  if (!allSuccessful) {
    throw new Error("Failed to add order to supply");
  }
}

const getLastSupply2 = async (
  token: string,
  getDone = true,
  next = 0,
  limit = 1000
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
    return getDone
      ? filteredSupplies[filteredSupplies.length - 2]
      : filteredSupplies[filteredSupplies.length - 1];
  }
};

const getLastSupply = async (
  token: string,
  getDone = true,
  next = 0,
  limit = 1000
): Promise<Supply | null> => {
  const response = await fetch(
    `${WB_AP_URL}/api/v3/supplies?limit=${limit}&next=${next}`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  );

  const jsonData = await response.json();
  let allSupplies: Supply[] = [];

  if (jsonData.supplies.length === limit) {
    // Return the result of the recursive call
    allSupplies = [...allSupplies, ...jsonData.supplies];
    const restOfSupplies = await getLastSupply(
      token,
      getDone,
      jsonData.next,
      limit
    );
    return restOfSupplies ? restOfSupplies : null;
  } else {
    allSupplies = [...allSupplies, ...jsonData.supplies];
  }

  const filteredSupplies = allSupplies.filter((supply) =>
    getDone ? supply.done : !supply.done
  );

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
  return getDone ? sortedSupplies[1] || null : sortedSupplies[0] || null;
};

export const getLastSupplyQrCode = async (token: string) => {
  const lastSupply = await getLastSupply(token);

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${lastSupply.id}/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return barCode;
};

export const processOrdersReal = async (token: string) => {
  const lastNotDoneSupply = await getLastSupply(token, false);
  let supply;

  if (!lastNotDoneSupply) {
    /* 
     Создаем поставку
   */
    const newDate = new Date();
    supply = await fetch(`${WB_AP_URL}/api/v3/supplies`, {
      method: "POST",
      headers: {
        Authorization: `${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formatDate(newDate),
      }),
    }).then((data) => data.json());
  } else {
    supply = lastNotDoneSupply;
  }

  const supplyId = supply.id;
  await simulateDelay(2000);
  /*
      Получаем новые заказы
    */
  const orders = await fetch(`${WB_AP_URL}/api/v3/orders/new`, {
    method: "GET",
    headers: {
      Authorization: `${token}`,
    },
  }).then((data) => data.json());

  const ordersIds = orders.orders.map((order: any) => order.id);

  //   /*
  //     Добавляем заказы к поставке
  //   */
  console.log("Orders to add to supply started at:", new Date());
  await addOrdersToSupplyReal(supply.id, ordersIds, token);

  console.log("Orders added to supply ended at:", new Date());

  await simulateDelay(2000);

  console.log("Supply are getting send to delivery start at ", new Date());
  //   // Put to delivery
  const deliverResponse = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${supply.id}/deliver`,
    {
      method: "PATCH",
      headers: {
        Authorization: `${token}`,
      },
    }
  );

  const json = await deliverResponse.json();

  console.log("Deliver response", {
    status: deliverResponse.status,
    statusText: deliverResponse.statusText,
    json: json,
    supplyId: supplyId,
  });

  console.log("Supply are getting send to delivery end at ", new Date());

  await simulateDelay(1000);

  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      let supply = await fetchSupplyData(supplyId, token);
      console.log("retryCount", retryCount);
      if (supply.done) {
        const barCodeResponse = await fetch(
          `${WB_AP_URL}/api/v3/supplies/${supplyId}/barcode?type=png`,
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
    `${WB_AP_URL}/api/v3/supplies/WB-GI-77468523/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return barCode;
};

async function fetchSupplyData(supplyId: string, token: string) {
  const response = await fetch(`${WB_AP_URL}/api/v3/supplies/${supplyId}`, {
    headers: {
      Authorization: `${token}`,
    },
  });
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
