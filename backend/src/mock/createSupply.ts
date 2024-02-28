import { simulateDelay } from "./utils/delay";

export async function createSupply(name: string): Promise<{ id: string }> {
  console.log(`Creating supply for ${name}...`);

  // Configurable delay in milliseconds (e.g., 2000ms = 2 seconds)
  const delay = 300;

  // Generate a 7 character long numeric value
  const randomNumber = () => Math.floor(Math.random() * 9000000) + 1000000;

  // Wait for the artificial delay
  await simulateDelay(delay);

  // Return the structure with the generated id
  return {
    id: `WB-GI-${randomNumber()}`,
  };
}
