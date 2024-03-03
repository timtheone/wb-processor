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

  results.forEach((result) => {
    if (!result.ok) {
      throw new Error("Failed to add order to supply");
    }
  });
}

export const getLastSupply = async (token: string) => {
  const getLastSupply = async (next = 0, limit = 200): Promise<Supply> => {
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
      return await getLastSupply(jsonData.next);
    } else {
      const doneSupplies = (jsonData.supplies as Supply[]).filter(
        (supply) => supply.done
      );
      // Return the last done supply
      return doneSupplies[doneSupplies.length - 2];
    }
  };

  const lastSupply = await getLastSupply();

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
  /* 
    Создаем поставку
  */
  const newSupply = await fetch(`${WB_AP_URL}/api/v3/supplies`, {
    method: "POST",
    headers: {
      Authorization: `${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Тестовая поставка от Тимура2",
    }),
  }).then((data) => data.json());

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

  /*
    Добавляем заказы к поставке
  */
  await addOrdersToSupplyReal(newSupply.id, ordersIds, token);

  await simulateDelay(1000);

  // Put to delivery
  await fetch(`${WB_AP_URL}/api/v3/supplies/${newSupply.id}/deliver`, {
    method: "PATCH",
    headers: {
      Authorization: `${token}`,
    },
  });

  // await simulateDelay(1000);

  const barCode = await fetch(
    `${WB_AP_URL}/api/v3/supplies/${newSupply.id}/barcode?type=png`,
    {
      headers: {
        Authorization: `${token}`,
      },
    }
  ).then((data) => data.json());

  return barCode;
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
