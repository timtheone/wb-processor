import { simulateDelay } from "./utils/delay";

export async function deliverSupply(supplyId: string): Promise<void> {
  console.log(`Delivering supply ${supplyId}...`);

  // Configurable delay in milliseconds (e.g., 2000ms = 2 seconds)
  const delay = 700;

  // Wait for the artificial delay
  await simulateDelay(delay);
}
