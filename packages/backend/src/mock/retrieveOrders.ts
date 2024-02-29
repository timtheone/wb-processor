import { simulateDelay } from "./utils/delay";

type Order = {
  address: null; // Assuming address is always null as per given example
  requiredMeta: any[]; // The type depends on the contents of the array, using 'any' for now
  deliveryType: string;
  user: null; // Assuming user is always null as per given example
  orderUid: string;
  article: string;
  rid: string;
  createdAt: string; // ISO date string
  offices: string[];
  skus: string[];
  id: number;
  warehouseId: number;
  nmId: number;
  chrtId: number;
  price: number;
  convertedPrice: number;
  currencyCode: number;
  convertedCurrencyCode: number;
  cargoType: number;
};

export async function retreiveNewOrders(): Promise<{ orders: Order[] }> {
  console.log(`Retrieving orders...`);

  // Configurable delay in milliseconds (e.g., 2000ms = 2 seconds)
  const delay = 300;

  // Wait for the artificial delay
  await simulateDelay(delay);

  // Return the structure with the generated id
  return {
    orders: [
      {
        address: null,
        requiredMeta: [],
        deliveryType: "fbs",
        user: null,
        orderUid: "26440538_22220269089059541",
        article: "2039453204770",
        rid: "22220269089059541.0.0",
        createdAt: "2024-02-17T09:58:06Z",
        offices: ["Санкт-Петербург"],
        skus: ["2039453204770"],
        id: 1445857408,
        warehouseId: 689865,
        nmId: 207312162,
        chrtId: 332645540,
        price: 38400,
        convertedPrice: 38400,
        currencyCode: 643,
        convertedCurrencyCode: 643,
        cargoType: 1,
      },
      {
        address: null,
        requiredMeta: [],
        deliveryType: "fbs",
        user: null,
        orderUid: "26440538_22220269089059541",
        article: "2039453204770",
        rid: "22220269089059541.0.0",
        createdAt: "2024-02-17T09:58:06Z",
        offices: ["Санкт-Петербург"],
        skus: ["2039453204770"],
        id: 1445857409,
        warehouseId: 689865,
        nmId: 207312162,
        chrtId: 332645540,
        price: 38400,
        convertedPrice: 38400,
        currencyCode: 643,
        convertedCurrencyCode: 643,
        cargoType: 1,
      },
      {
        address: null,
        requiredMeta: [],
        deliveryType: "fbs",
        user: null,
        orderUid: "26440538_22220269089059541",
        article: "2039453204770",
        rid: "22220269089059541.0.0",
        createdAt: "2024-02-17T09:58:06Z",
        offices: ["Санкт-Петербург"],
        skus: ["2039453204770"],
        id: 1445857410,
        warehouseId: 689865,
        nmId: 207312162,
        chrtId: 332645540,
        price: 38400,
        convertedPrice: 38400,
        currencyCode: 643,
        convertedCurrencyCode: 643,
        cargoType: 1,
      },
    ],
  };
}
