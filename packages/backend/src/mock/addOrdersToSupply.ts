import { simulateDelay } from "./utils/delay";

async function addSingleOrderToSupply(supplyId: string, orderId: number) {
  const delay = 800;

  // Wait for the artificial delay
  await simulateDelay(delay);
  console.log(
    `simulating api call to add single order ${orderId} to supply ${supplyId}`
  );

  return {
    id: orderId,
  };
}

export async function addOrdersToSupply(
  supplyId: string,
  orderIds: number[]
): Promise<{ id: number }[]> {
  console.log(`Adding orders to supply ${supplyId}...`);

  // Configurable delay in milliseconds (e.g., 2000ms = 2 seconds)
  const delay = 100;

  const results = await Promise.allSettled(
    orderIds.map((orderId) => addSingleOrderToSupply(supplyId, orderId))
  );

  // Assuming you want to filter out successfully added orders and return their IDs
  const successfulOrders = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => ({
      id: (result as PromiseFulfilledResult<{ id: number }>).value.id,
    }));

  return successfulOrders;
}
