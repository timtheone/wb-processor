export function simulateDelay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
