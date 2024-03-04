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

  const allSuccessful = results.every(
    (result) => result.status >= 200 && result.status < 300
  );

  if (!allSuccessful) {
    throw new Error("Failed to add order to supply");
  }
}

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

  console.log("token", token);

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

export const getLastSupplyQrCode = async (token: string) => {
  const lastSupply = await getLastSupply(token);

  console.log("lastSupply", lastSupply);

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
